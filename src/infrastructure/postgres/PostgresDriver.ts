import { DatabaseDriver } from '../../domain/interfaces.js';
import { DatabaseConnection, Table, Schema, ForeignKey, Column, Index } from '../../domain/entities.js';
import { EncryptionService } from '../../application/services/EncryptionService.js';
import pg from 'pg';

const SCHEMA_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export class PostgresDriver implements DatabaseDriver {
  private client: pg.Client | null = null;
  private currentConnectionInfo: DatabaseConnection | null = null;
  private activeSchema: string = 'public';

  constructor(private readonly encryptionService: EncryptionService) {}

  async connect(
    connection: DatabaseConnection,
    databaseName?: string,
    schemaName?: string,
  ): Promise<void> {
    if (this.client) {
      await this.disconnect();
    }

    const password = await this.encryptionService.decrypt(connection.passwordEncrypted);
    const dbName = databaseName || connection.databaseName;

    this.client = new pg.Client({
      host: connection.host,
      port: connection.port,
      user: connection.username,
      password: password,
      database: dbName,
      // Short connection timeout for a snappy UX
      connectionTimeoutMillis: 5000,
    });

    await this.client.connect();
    this.activeSchema = schemaName || 'public';
    // Keep search_path in sync so unqualified queries (e.g. `dbia query "SELECT * FROM foo"`)
    // resolve to the active schema before falling back to public.
    await this.applySchema(this.activeSchema);
    this.currentConnectionInfo = connection;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
      this.currentConnectionInfo = null;
      this.activeSchema = 'public';
    }
  }

  private ensureConnected(): pg.Client {
    if (!this.client) {
      throw new Error('No active PostgreSQL database connection.');
    }
    return this.client;
  }

  private validateSchemaName(name: string): void {
    if (!SCHEMA_NAME_REGEX.test(name)) {
      throw new Error(
        `Invalid schema name '${name}'. Only letters, digits and underscores are allowed, and the first character must be a letter or underscore.`,
      );
    }
  }

  private async applySchema(schemaName: string): Promise<void> {
    this.validateSchemaName(schemaName);
    const client = this.ensureConnected();
    await client.query(`SET search_path TO "${schemaName}", public`);
    this.activeSchema = schemaName;
  }

  async listSchemas(): Promise<string[]> {
    const client = this.ensureConnected();
    const res = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
        AND schema_name NOT LIKE 'pg_temp_%'
        AND schema_name NOT LIKE 'pg_toast%'
      ORDER BY schema_name ASC
    `);
    return res.rows.map((row: any) => row.schema_name);
  }

  async setSchema(schemaName: string): Promise<void> {
    await this.applySchema(schemaName);
  }

  async getCurrentSchema(): Promise<string> {
    return this.activeSchema;
  }

  async listDatabases(): Promise<string[]> {
    const client = this.ensureConnected();
    const res = await client.query(`
      SELECT datname as name
      FROM pg_database
      WHERE datistemplate = false
      ORDER BY datname ASC
    `);
    return res.rows.map((row: any) => row.name);
  }

  async listTables(): Promise<string[]> {
    const client = this.ensureConnected();
    const res = await client.query(
      `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `,
      [this.activeSchema],
    );
    return res.rows.map((row: any) => row.table_name);
  }

  async getTableInfo(tableName: string): Promise<Table> {
    const client = this.ensureConnected();

    // 1. Get Columns
    const colsRes = await client.query(
      `
      SELECT
        c.column_name as name,
        c.data_type as type,
        c.is_nullable = 'YES' as nullable,
        c.column_default as default_value,
        (SELECT EXISTS (
          SELECT 1 FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_name = c.table_name
            AND kcu.column_name = c.column_name
        )) as is_primary_key
      FROM information_schema.columns c
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position ASC
    `,
      [this.activeSchema, tableName],
    );

    const columns: Column[] = colsRes.rows.map((row: any) => ({
      name: row.name,
      type: row.type,
      nullable: row.nullable,
      isPrimaryKey: row.is_primary_key,
      defaultValue: row.default_value,
    }));

    if (columns.length === 0) {
      throw new Error(`Table '${tableName}' does not exist or has no columns.`);
    }

    // 2. Get Indexes
    const idxRes = await client.query(
      `
      SELECT
        i.relname as index_name,
        ix.indisunique as unique,
        a.attname as column_name
      FROM
        pg_class t,
        pg_class i,
        pg_index ix,
        pg_attribute a
      WHERE
        t.oid = ix.indrelid
        AND i.oid = ix.indexrelid
        AND a.attrelid = t.oid
        AND a.attnum = ANY(ix.indkey)
        AND t.relkind = 'r'
        AND t.relname = $1
        AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = $2)
    `,
      [tableName, this.activeSchema],
    );

    const indexMap = new Map<string, { name: string; columns: string[]; unique: boolean }>();
    for (const row of idxRes.rows) {
      if (!indexMap.has(row.index_name)) {
        indexMap.set(row.index_name, {
          name: row.index_name,
          columns: [],
          unique: row.unique,
        });
      }
      indexMap.get(row.index_name)!.columns.push(row.column_name);
    }
    const indexes: Index[] = Array.from(indexMap.values());

    // 3. Get Foreign Keys
    const fkRes = await client.query(
      `
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS referenced_table_name,
        ccu.column_name AS referenced_column_name
      FROM
        information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
    `,
      [this.activeSchema, tableName],
    );

    const foreignKeys: ForeignKey[] = fkRes.rows.map((row: any) => ({
      constraintName: row.constraint_name,
      columnName: row.column_name,
      referencedTableName: row.referenced_table_name,
      referencedColumnName: row.referenced_column_name,
    }));

    return {
      name: tableName,
      columns,
      indexes,
      foreignKeys,
    };
  }

  async getSchema(): Promise<Schema> {
    const tableNames = await this.listTables();
    const tables: Table[] = [];

    for (const name of tableNames) {
      try {
        const tableInfo = await this.getTableInfo(name);
        tables.push(tableInfo);
      } catch {
        // Ignore individual errors if a table fails
      }
    }

    return { tables };
  }

  async getRelations(): Promise<ForeignKey[]> {
    const client = this.ensureConnected();
    const res = await client.query(
      `
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS referenced_table_name,
        ccu.column_name AS referenced_column_name
      FROM
        information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
    `,
      [this.activeSchema],
    );

    return res.rows.map((row: any) => ({
      constraintName: row.constraint_name,
      columnName: `${row.table_name}.${row.column_name}`,
      referencedTableName: row.referenced_table_name,
      referencedColumnName: row.referenced_column_name,
    }));
  }

  async query(sql: string): Promise<any[]> {
    const client = this.ensureConnected();
    const res = await client.query(sql);
    if (Array.isArray(res)) {
      // If multiple queries were executed together
      return res[res.length - 1]?.rows || [];
    }
    return res.rows || [];
  }
}

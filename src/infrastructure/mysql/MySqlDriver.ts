import { DatabaseDriver } from '../../domain/interfaces.js';
import { DatabaseConnection, Table, Schema, ForeignKey, Column, Index } from '../../domain/entities.js';
import { EncryptionService } from '../../application/services/EncryptionService.js';
import mysql, { Connection } from 'mysql2/promise';

export class MySqlDriver implements DatabaseDriver {
  private connection: Connection | null = null;
  private currentDb: string | null = null;

  constructor(private readonly encryptionService: EncryptionService) {}

  async connect(connection: DatabaseConnection, databaseName?: string): Promise<void> {
    if (this.connection) {
      await this.disconnect();
    }

    const password = await this.encryptionService.decrypt(connection.passwordEncrypted);
    const dbName = databaseName || connection.databaseName;

    this.connection = await mysql.createConnection({
      host: connection.host,
      port: connection.port,
      user: connection.username,
      password: password,
      database: dbName,
      connectTimeout: 5000,
    });

    this.currentDb = dbName;
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
      this.currentDb = null;
    }
  }

  private ensureConnected(): Connection {
    if (!this.connection) {
      throw new Error('No active MySQL database connection.');
    }
    return this.connection;
  }

  async listDatabases(): Promise<string[]> {
    const conn = this.ensureConnected();
    const [rows] = await conn.query('SHOW DATABASES');
    return (rows as any[]).map((row: any) => Object.values(row)[0] as string);
  }

  async listSchemas(): Promise<string[]> {
    throw new Error("MySQL does not have schemas. Use 'dbia db use <name>' to switch databases instead.");
  }

  async setSchema(_schemaName: string): Promise<void> {
    throw new Error("MySQL does not have schemas. Use 'dbia db use <name>' to switch databases instead.");
  }

  async getCurrentSchema(): Promise<string> {
    // For MySQL, "schema" === database. Return whatever the driver is connected to.
    return this.currentDb || '';
  }

  async listTables(): Promise<string[]> {
    const conn = this.ensureConnected();
    const [rows] = await conn.query('SHOW TABLES');
    return (rows as any[]).map((row: any) => Object.values(row)[0] as string);
  }

  async getTableInfo(tableName: string): Promise<Table> {
    const conn = this.ensureConnected();
    const schema = this.currentDb;

    if (!schema) {
      throw new Error('No active database selected.');
    }

    // 1. Get Columns
    const [colRows] = await conn.query(
      `SELECT
        COLUMN_NAME as name,
        COLUMN_TYPE as type,
        IS_NULLABLE = 'YES' as nullable,
        COLUMN_KEY = 'PRI' as is_primary_key,
        COLUMN_DEFAULT as default_value,
        COLUMN_COMMENT as comment
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION ASC`,
      [schema, tableName]
    );

    const columns: Column[] = (colRows as any[]).map((row: any) => ({
      name: row.name,
      type: row.type,
      nullable: row.nullable === 1 || row.nullable === true,
      isPrimaryKey: row.is_primary_key === 1 || row.is_primary_key === true,
      defaultValue: row.default_value,
      comment: row.comment || undefined,
    }));

    if (columns.length === 0) {
      throw new Error(`Table '${tableName}' does not exist or has no columns.`);
    }

    // 2. Get Indexes
    const [idxRows] = await conn.query(
      `SELECT
        INDEX_NAME as index_name,
        COLUMN_NAME as column_name,
        NON_UNIQUE = 0 as \`unique\`
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY INDEX_NAME, SEQ_IN_INDEX ASC`,
      [schema, tableName]
    );

    const indexMap = new Map<string, { name: string; columns: string[]; unique: boolean }>();
    for (const row of idxRows as any[]) {
      if (!indexMap.has(row.index_name)) {
        indexMap.set(row.index_name, {
          name: row.index_name,
          columns: [],
          unique: row.unique === 1 || row.unique === true,
        });
      }
      indexMap.get(row.index_name)!.columns.push(row.column_name);
    }
    const indexes: Index[] = Array.from(indexMap.values());

    // 3. Get Foreign Keys
    const [fkRows] = await conn.query(
      `SELECT
        CONSTRAINT_NAME as constraint_name,
        COLUMN_NAME as column_name,
        REFERENCED_TABLE_NAME as referenced_table_name,
        REFERENCED_COLUMN_NAME as referenced_column_name
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [schema, tableName]
    );

    const foreignKeys: ForeignKey[] = (fkRows as any[]).map((row: any) => ({
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
        // Ignore individual errors
      }
    }

    return { tables };
  }

  async getRelations(): Promise<ForeignKey[]> {
    const conn = this.ensureConnected();
    const schema = this.currentDb;

    if (!schema) {
      throw new Error('No active database selected.');
    }

    const [rows] = await conn.query(
      `SELECT
        CONSTRAINT_NAME as constraint_name,
        TABLE_NAME as table_name,
        COLUMN_NAME as column_name,
        REFERENCED_TABLE_NAME as referenced_table_name,
        REFERENCED_COLUMN_NAME as referenced_column_name
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [schema]
    );

    return (rows as any[]).map((row: any) => ({
      constraintName: row.constraint_name,
      columnName: `${row.table_name}.${row.column_name}`,
      referencedTableName: row.referenced_table_name,
      referencedColumnName: row.referenced_column_name,
    }));
  }

  async query(sql: string): Promise<any[]> {
    const conn = this.ensureConnected();
    const [rows] = await conn.query(sql);
    if (Array.isArray(rows)) {
      return rows;
    }
    // For INSERT/UPDATE queries that return an OkPacket
    return [rows];
  }
}

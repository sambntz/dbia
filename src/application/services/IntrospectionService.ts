import {
  ConnectionRepository,
  ContextRepository,
  DatabaseDriver,
} from '../../domain/interfaces.js';
import { DriverFactory } from '../../infrastructure/factories/DriverFactory.js';
import { Table, Schema, ForeignKey, DatabaseConnection } from '../../domain/entities.js';

export class IntrospectionService {
  private driver: DatabaseDriver | null = null;
  private currentConnectionId: string | null = null;
  private currentSchema: string | null = null;

  constructor(
    private readonly connectionRepository: ConnectionRepository,
    private readonly contextRepository: ContextRepository,
    private readonly driverFactory: DriverFactory,
  ) {}

  private async loadActiveConnection(): Promise<DatabaseConnection> {
    const context = await this.contextRepository.getContext();

    if (!context.activeConnectionId) {
      throw new Error('No active connection. Use "dbia connection use <name>".');
    }

    const connection = await this.connectionRepository.findById(context.activeConnectionId);
    if (!connection) {
      throw new Error(
        'The active connection no longer exists. Use "dbia connection list" and select another with "dbia connection use <name>".',
      );
    }
    return connection;
  }

  private async ensureDriver(): Promise<DatabaseDriver> {
    const context = await this.contextRepository.getContext();
    const connection = await this.loadActiveConnection();

    const desiredSchema = context.activeSchema || undefined;

    // Reuse the driver if it is already connected to the same connection AND schema
    if (
      this.driver &&
      this.currentConnectionId === connection.id &&
      this.currentSchema === desiredSchema
    ) {
      return this.driver;
    }

    if (this.driver) {
      await this.driver.disconnect();
    }

    this.driver = this.driverFactory.createDriver(connection.type);
    await this.driver.connect(
      connection,
      context.activeDatabase || connection.databaseName,
      desiredSchema,
    );
    this.currentConnectionId = connection.id;
    this.currentSchema = desiredSchema ?? null;

    return this.driver;
  }

  async listDatabases(): Promise<string[]> {
    const driver = await this.ensureDriver();
    return driver.listDatabases();
  }

  async useDatabase(databaseName: string): Promise<void> {
    const context = await this.contextRepository.getContext();
    const connection = await this.loadActiveConnection();

    // Reconnect to the new database
    if (this.driver) {
      await this.driver.disconnect();
    }
    this.driver = this.driverFactory.createDriver(connection.type);
    await this.driver.connect(connection, databaseName);
    this.currentConnectionId = connection.id;
    this.currentSchema = null;

    // Reset the active schema: the new database may not have the previously
    // selected schema, and the next call should resolve through the driver's
    // default (public for PG, the database itself for MySQL).
    context.activeDatabase = databaseName;
    context.activeSchema = null;
    await this.contextRepository.saveContext(context);
  }

  async getCurrentDatabase(): Promise<string | null> {
    const context = await this.contextRepository.getContext();
    return context.activeDatabase;
  }

  async listSchemas(): Promise<string[]> {
    const driver = await this.ensureDriver();
    return driver.listSchemas();
  }

  async useSchema(schemaName: string): Promise<void> {
    const trimmed = schemaName.trim();
    if (trimmed.length === 0) {
      throw new Error('The schema name cannot be empty.');
    }

    const driver = await this.ensureDriver();
    const available = await driver.listSchemas();
    if (!available.includes(trimmed)) {
      throw new Error(
        `Schema '${trimmed}' not found in the active database. Use 'dbia db schema list' to see available schemas.`,
      );
    }

    await driver.setSchema(trimmed);
    this.currentSchema = trimmed;

    const context = await this.contextRepository.getContext();
    context.activeSchema = trimmed;
    await this.contextRepository.saveContext(context);
  }

  async getCurrentSchema(): Promise<string | null> {
    const driver = await this.ensureDriver();
    const schema = await driver.getCurrentSchema();
    return schema || null;
  }

  async listTables(): Promise<string[]> {
    const driver = await this.ensureDriver();
    return driver.listTables();
  }

  async showTable(tableName: string): Promise<Table> {
    const driver = await this.ensureDriver();
    return driver.getTableInfo(tableName);
  }

  async getSchema(): Promise<Schema> {
    const driver = await this.ensureDriver();
    return driver.getSchema();
  }

  async getRelations(): Promise<ForeignKey[]> {
    const driver = await this.ensureDriver();
    return driver.getRelations();
  }

  async searchTables(query: string): Promise<string[]> {
    const tables = await this.listTables();
    const lowerQuery = query.toLowerCase();
    return tables.filter((t) => t.toLowerCase().includes(lowerQuery));
  }

  async executeQuery(sql: string): Promise<any[]> {
    const driver = await this.ensureDriver();
    return driver.query(sql);
  }

  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.disconnect();
      this.driver = null;
      this.currentConnectionId = null;
      this.currentSchema = null;
    }
  }
}

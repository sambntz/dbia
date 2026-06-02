import { DatabaseConnection, Table, Schema, ForeignKey, AppContext } from './entities.js';

export interface DatabaseDriver {
  connect(
    connection: DatabaseConnection,
    databaseName?: string,
    schemaName?: string,
  ): Promise<void>;
  disconnect(): Promise<void>;
  listDatabases(): Promise<string[]>;
  listSchemas(): Promise<string[]>;
  setSchema(schemaName: string): Promise<void>;
  getCurrentSchema(): Promise<string>;
  listTables(): Promise<string[]>;
  getTableInfo(tableName: string): Promise<Table>;
  getSchema(): Promise<Schema>;
  getRelations(): Promise<ForeignKey[]>;
  query(sql: string): Promise<any[]>;
}

export interface ConnectionRepository {
  save(connection: DatabaseConnection): Promise<void>;
  findById(id: string): Promise<DatabaseConnection | null>;
  findByName(name: string): Promise<DatabaseConnection | null>;
  findAll(): Promise<DatabaseConnection[]>;
  delete(id: string): Promise<void>;
}

export interface ContextRepository {
  getContext(): Promise<AppContext>;
  saveContext(context: AppContext): Promise<void>;
}

export interface SecretProvider {
  getMasterKey(): Promise<Buffer>;
}

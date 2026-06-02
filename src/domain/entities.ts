export type DatabaseType = 'mysql' | 'postgres';

export interface DatabaseConnection {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  username: string;
  passwordEncrypted: string;
  databaseName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Database {
  name: string;
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  defaultValue: string | null;
  comment?: string;
}

export interface Index {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface ForeignKey {
  constraintName: string;
  columnName: string;
  referencedTableName: string;
  referencedColumnName: string;
}

export interface Table {
  name: string;
  columns: Column[];
  indexes: Index[];
  foreignKeys: ForeignKey[];
}

export interface Schema {
  tables: Table[];
}

export const OUTPUT_FORMATS = ['plain', 'json', 'table'] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];
export const DEFAULT_OUTPUT_FORMAT: OutputFormat = 'plain';

export interface AppPreferences {
  outputFormat?: OutputFormat;
  [key: string]: any;
}

export interface AppContext {
  activeConnectionId: string | null;
  activeDatabase: string | null;
  activeSchema: string | null;
  preferences: AppPreferences;
}

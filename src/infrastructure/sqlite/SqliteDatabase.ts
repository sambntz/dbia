import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

export class SqliteDatabase {
  private static getDefaultDir(): string {
    return process.env.DBIA_DATA_DIR || path.join(os.homedir(), '.dbia');
  }

  private static getDefaultPath(): string {
    return path.join(SqliteDatabase.getDefaultDir(), 'dbia.sqlite');
  }

  private readonly dbPath: string;

  private dbInstance: Database | null = null;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || SqliteDatabase.getDefaultPath();
  }

  async getDb(): Promise<Database> {
    if (this.dbInstance) {
      return this.dbInstance;
    }

    // Ensure the directory exists
    const dir = path.dirname(this.dbPath);
    await fs.mkdir(dir, { recursive: true });

    this.dbInstance = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
    });

    await this.initializeSchema();
    return this.dbInstance;
  }

  private async initializeSchema(): Promise<void> {
    const db = this.dbInstance;
    if (!db) return;

    // Enable foreign keys
    await db.run('PRAGMA foreign_keys = ON;');

    // Create connections table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        username TEXT NOT NULL,
        password_encrypted TEXT NOT NULL,
        database_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Create context table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS context (
        key TEXT PRIMARY KEY,
        active_connection_id TEXT,
        active_database TEXT,
        active_schema TEXT,
        preferences TEXT,
        FOREIGN KEY (active_connection_id) REFERENCES connections(id) ON DELETE SET NULL
      );
    `);

    // Migration for existing installs that predate the active_schema column
    const cols = await db.all("PRAGMA table_info(context)");
    if (!cols.some((c: any) => c.name === 'active_schema')) {
      await db.run('ALTER TABLE context ADD COLUMN active_schema TEXT');
    }

    // Insert the initial context if it does not exist
    const context = await db.get("SELECT key FROM context WHERE key = 'current'");
    if (!context) {
      await db.run(`
        INSERT INTO context (key, active_connection_id, active_database, active_schema, preferences)
        VALUES ('current', NULL, NULL, NULL, '{}')
      `);
    }
  }

  async close(): Promise<void> {
    if (this.dbInstance) {
      await this.dbInstance.close();
      this.dbInstance = null;
    }
  }
}

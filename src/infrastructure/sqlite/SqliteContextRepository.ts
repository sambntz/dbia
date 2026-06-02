import { ContextRepository } from '../../domain/interfaces.js';
import { AppContext } from '../../domain/entities.js';
import { SqliteDatabase } from './SqliteDatabase.js';

export class SqliteContextRepository implements ContextRepository {
  constructor(private readonly sqliteDb: SqliteDatabase) {}

  async getContext(): Promise<AppContext> {
    const db = await this.sqliteDb.getDb();
    const row = await db.get("SELECT * FROM context WHERE key = 'current'");

    if (!row) {
      return {
        activeConnectionId: null,
        activeDatabase: null,
        activeSchema: null,
        preferences: {},
      };
    }

    let preferences: Record<string, any> = {};
    try {
      if (row.preferences) {
        preferences = JSON.parse(row.preferences);
      }
    } catch {
      preferences = {};
    }

    return {
      activeConnectionId: row.active_connection_id || null,
      activeDatabase: row.active_database || null,
      activeSchema: row.active_schema || null,
      preferences,
    };
  }

  async saveContext(context: AppContext): Promise<void> {
    const db = await this.sqliteDb.getDb();
    const preferencesStr = JSON.stringify(context.preferences || {});

    await db.run(
      `UPDATE context 
       SET active_connection_id = ?, active_database = ?, active_schema = ?, preferences = ? 
       WHERE key = 'current'`,
      context.activeConnectionId,
      context.activeDatabase,
      context.activeSchema,
      preferencesStr,
    );
  }
}

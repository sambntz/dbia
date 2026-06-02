import { ConnectionRepository } from '../../domain/interfaces.js';
import { DatabaseConnection } from '../../domain/entities.js';
import { SqliteDatabase } from './SqliteDatabase.js';

export class SqliteConnectionRepository implements ConnectionRepository {
  constructor(private readonly sqliteDb: SqliteDatabase) {}

  async save(conn: DatabaseConnection): Promise<void> {
    const db = await this.sqliteDb.getDb();
    
    // Check whether it already exists to decide between INSERT and UPDATE
    const existing = await db.get('SELECT id FROM connections WHERE id = ?', conn.id);
    
    if (existing) {
      await db.run(
        `UPDATE connections 
         SET name = ?, type = ?, host = ?, port = ?, username = ?, password_encrypted = ?, database_name = ?, updated_at = ? 
         WHERE id = ?`,
        conn.name,
        conn.type,
        conn.host,
        conn.port,
        conn.username,
        conn.passwordEncrypted,
        conn.databaseName,
        conn.updatedAt,
        conn.id,
      );
    } else {
      await db.run(
        `INSERT INTO connections (id, name, type, host, port, username, password_encrypted, database_name, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        conn.id,
        conn.name,
        conn.type,
        conn.host,
        conn.port,
        conn.username,
        conn.passwordEncrypted,
        conn.databaseName,
        conn.createdAt,
        conn.updatedAt,
      );
    }
  }

  async findById(id: string): Promise<DatabaseConnection | null> {
    const db = await this.sqliteDb.getDb();
    const row = await db.get('SELECT * FROM connections WHERE id = ?', id);
    if (!row) return null;
    return this.mapToEntity(row);
  }

  async findByName(name: string): Promise<DatabaseConnection | null> {
    const db = await this.sqliteDb.getDb();
    const row = await db.get('SELECT * FROM connections WHERE name = ?', name);
    if (!row) return null;
    return this.mapToEntity(row);
  }

  async findAll(): Promise<DatabaseConnection[]> {
    const db = await this.sqliteDb.getDb();
    const rows = await db.all('SELECT * FROM connections ORDER BY name ASC');
    return rows.map((row) => this.mapToEntity(row));
  }

  async delete(id: string): Promise<void> {
    const db = await this.sqliteDb.getDb();
    await db.run('DELETE FROM connections WHERE id = ?', id);
  }

  private mapToEntity(row: any): DatabaseConnection {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      host: row.host,
      port: row.port,
      username: row.username,
      passwordEncrypted: row.password_encrypted,
      databaseName: row.database_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

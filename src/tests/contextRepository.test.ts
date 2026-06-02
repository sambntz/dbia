import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteDatabase } from '../infrastructure/sqlite/SqliteDatabase.js';
import { SqliteContextRepository } from '../infrastructure/sqlite/SqliteContextRepository.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('SqliteContextRepository', () => {
  let sqliteDb: SqliteDatabase;
  let repo: SqliteContextRepository;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbia-ctx-test-'));
    process.env.DBIA_DATA_DIR = tempDir;
    sqliteDb = new SqliteDatabase();
    repo = new SqliteContextRepository(sqliteDb);
  });

  afterEach(async () => {
    await sqliteDb.close();
    delete process.env.DBIA_DATA_DIR;
  });

  it('returns an empty context on a fresh database', async () => {
    const ctx = await repo.getContext();
    expect(ctx.activeConnectionId).toBeNull();
    expect(ctx.activeDatabase).toBeNull();
    expect(ctx.activeSchema).toBeNull();
    expect(ctx.preferences).toEqual({});
  });

  it('roundtrips activeSchema', async () => {
    const saved = await repo.getContext();
    saved.activeSchema = 'prueba';
    await repo.saveContext(saved);

    const loaded = await repo.getContext();
    expect(loaded.activeSchema).toBe('prueba');
  });

  it('migrates an old context table that lacks active_schema', async () => {
    // Simulate a database created before the active_schema column existed
    const db = await sqliteDb.getDb();
    await db.run(`DELETE FROM context`);
    await db.run(
      `INSERT INTO context (key, active_connection_id, active_database, preferences)
       VALUES ('current', NULL, 'legacy_db', '{}')`,
    );

    // Reopen the database to force re-initialization of the schema
    await sqliteDb.close();
    sqliteDb = new SqliteDatabase();
    repo = new SqliteContextRepository(sqliteDb);

    const ctx = await repo.getContext();
    expect(ctx.activeDatabase).toBe('legacy_db');
    expect(ctx.activeSchema).toBeNull();

    // And the column must be writable afterwards
    ctx.activeSchema = 'public';
    await repo.saveContext(ctx);
    expect((await repo.getContext()).activeSchema).toBe('public');
  });
});

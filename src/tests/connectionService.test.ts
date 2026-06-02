import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConnectionService } from '../application/services/ConnectionService.js';
import { SqliteConnectionRepository } from '../infrastructure/sqlite/SqliteConnectionRepository.js';
import { SqliteContextRepository } from '../infrastructure/sqlite/SqliteContextRepository.js';
import { SqliteDatabase } from '../infrastructure/sqlite/SqliteDatabase.js';
import { EncryptionService } from '../application/services/EncryptionService.js';
import { SecretProvider } from '../domain/interfaces.js';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

class MockSecretProvider implements SecretProvider {
  async getMasterKey(): Promise<Buffer> {
    return crypto.createHash('sha256').update('test-key').digest();
  }
}

describe('ConnectionService', () => {
  let sqliteDb: SqliteDatabase;
  let service: ConnectionService;

  beforeEach(async () => {
    // Use a temporary database
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbia-test-'));
    process.env.DBIA_DATA_DIR = tempDir;
    process.env.DBIA_MASTER_KEY = 'test-master-key';

    sqliteDb = new SqliteDatabase();
    const encryption = new EncryptionService(new MockSecretProvider());
    const connectionRepo = new SqliteConnectionRepository(sqliteDb);
    const contextRepo = new SqliteContextRepository(sqliteDb);

    service = new ConnectionService(connectionRepo, contextRepo, encryption);
  });

  afterEach(async () => {
    await sqliteDb.close();
    delete process.env.DBIA_DATA_DIR;
  });

  it('should add a new connection', async () => {
    const conn = await service.addConnection({
      name: 'test-conn',
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'secret',
      databaseName: 'test_db',
    });

    expect(conn.name).toBe('test-conn');
    expect(conn.type).toBe('mysql');
    expect(conn.passwordEncrypted).toBeTruthy();
    expect(conn.passwordEncrypted).not.toBe('secret'); // Must not be plain text
    expect(conn.id).toBeTruthy();
    expect(conn.createdAt).toBeTruthy();
  });

  it('should list connections', async () => {
    await service.addConnection({
      name: 'a', type: 'mysql', host: 'localhost', port: 3306,
      username: 'root', password: 'p', databaseName: 'd',
    });
    await service.addConnection({
      name: 'b', type: 'postgres', host: 'localhost', port: 5432,
      username: 'postgres', password: 'p', databaseName: 'd',
    });
    const list = await service.listConnections();
    expect(list).toHaveLength(2);
  });

  it('should reject duplicate names', async () => {
    await service.addConnection({
      name: 'dup', type: 'mysql', host: 'localhost', port: 3306,
      username: 'root', password: 'p', databaseName: 'd',
    });
    await expect(service.addConnection({
      name: 'dup', type: 'mysql', host: 'localhost', port: 3306,
      username: 'root', password: 'p', databaseName: 'd',
    })).rejects.toThrow(/A connection with the name/);
  });

  it('should select an active connection', async () => {
    await service.addConnection({
      name: 'a', type: 'mysql', host: 'localhost', port: 3306,
      username: 'root', password: 'p', databaseName: 'd',
    });
    const result = await service.useConnection('a');
    expect(result.name).toBe('a');

    const current = await service.getCurrentConnection();
    expect(current?.name).toBe('a');
  });

  it('should remove a connection', async () => {
    await service.addConnection({
      name: 'a', type: 'mysql', host: 'localhost', port: 3306,
      username: 'root', password: 'p', databaseName: 'd',
    });
    await service.removeConnection('a');
    const list = await service.listConnections();
    expect(list).toHaveLength(0);
  });

  it('should clear the active connection if it is removed', async () => {
    await service.addConnection({
      name: 'a', type: 'mysql', host: 'localhost', port: 3306,
      username: 'root', password: 'p', databaseName: 'd',
    });
    await service.useConnection('a');
    await service.removeConnection('a');
    const current = await service.getCurrentConnection();
    expect(current).toBeNull();
  });

  it('should reset activeDatabase to the new connection default when switching', async () => {
    await service.addConnection({
      name: 'loyalty-conn', type: 'mysql', host: 'localhost', port: 3306,
      username: 'root', password: 'p', databaseName: 'loyalty',
    });
    await service.addConnection({
      name: 'dev-conn', type: 'mysql', host: 'localhost', port: 3306,
      username: 'root', password: 'p', databaseName: 'dev_db',
    });

    await service.useConnection('loyalty-conn');
    const ctx1 = await service['contextRepository'].getContext();
    expect(ctx1.activeConnectionId).toBeTruthy();
    expect(ctx1.activeDatabase).toBe('loyalty');

    // Switch to the other connection: the active database MUST be reset
    // to the new connection's default, otherwise the driver will try to
    // open "loyalty" on a server that does not have it.
    await service.useConnection('dev-conn');
    const ctx2 = await service['contextRepository'].getContext();
    expect(ctx2.activeDatabase).toBe('dev_db');
  });

  it('should rename a connection', async () => {
    const original = await service.addConnection({
      name: 'old-name', type: 'mysql', host: 'localhost', port: 3306,
      username: 'root', password: 'p', databaseName: 'd',
    });
    const originalUpdatedAt = original.updatedAt;

    // Wait at least 1 ms to guarantee the updatedAt timestamp changes
    await new Promise((resolve) => setTimeout(resolve, 5));

    const renamed = await service.renameConnection('old-name', 'new-name');
    expect(renamed.id).toBe(original.id);
    expect(renamed.name).toBe('new-name');
    expect(renamed.host).toBe('localhost');
    expect(renamed.passwordEncrypted).toBe(original.passwordEncrypted);
    expect(renamed.updatedAt).not.toBe(originalUpdatedAt);

    const fetched = await service.showConnection('new-name');
    expect(fetched.id).toBe(original.id);

    const list = await service.listConnections();
    expect(list.map((c) => c.name)).toEqual(['new-name']);
  });

  it('should reject rename when the new name already exists', async () => {
    await service.addConnection({
      name: 'a', type: 'mysql', host: 'localhost', port: 3306,
      username: 'root', password: 'p', databaseName: 'd',
    });
    await service.addConnection({
      name: 'b', type: 'mysql', host: 'localhost', port: 3306,
      username: 'root', password: 'p', databaseName: 'd',
    });

    await expect(service.renameConnection('a', 'b')).rejects.toThrow(/already exists/);
  });

  it('should reject renaming to the same name', async () => {
    await service.addConnection({
      name: 'a', type: 'mysql', host: 'localhost', port: 3306,
      username: 'root', password: 'p', databaseName: 'd',
    });
    await expect(service.renameConnection('a', 'a')).rejects.toThrow(/already named/);
  });

  it('should reject renaming to an empty name', async () => {
    await service.addConnection({
      name: 'a', type: 'mysql', host: 'localhost', port: 3306,
      username: 'root', password: 'p', databaseName: 'd',
    });
    await expect(service.renameConnection('a', '   ')).rejects.toThrow(/empty/);
  });

  it('should reject renaming a non-existent connection', async () => {
    await expect(service.renameConnection('missing', 'new-name')).rejects.toThrow(
      /No connection/,
    );
  });

  it('should reset activeSchema when switching connections', async () => {
    await service.addConnection({
      name: 'a', type: 'postgres', host: 'localhost', port: 5432,
      username: 'postgres', password: 'p', databaseName: 'd',
    });
    await service.useConnection('a');
    // Simulate the IntrospectionService having set a schema
    const ctxRepo = (service as any).contextRepository as SqliteContextRepository;
    const ctx0 = await ctxRepo.getContext();
    ctx0.activeSchema = 'prueba';
    await ctxRepo.saveContext(ctx0);

    await service.useConnection('a');
    const ctx1 = await ctxRepo.getContext();
    expect(ctx1.activeSchema).toBeNull();
  });

  it('should clear activeSchema when removing the active connection', async () => {
    await service.addConnection({
      name: 'a', type: 'postgres', host: 'localhost', port: 5432,
      username: 'postgres', password: 'p', databaseName: 'd',
    });
    await service.useConnection('a');
    const ctxRepo = (service as any).contextRepository as SqliteContextRepository;
    const ctx0 = await ctxRepo.getContext();
    ctx0.activeSchema = 'prueba';
    await ctxRepo.saveContext(ctx0);

    await service.removeConnection('a');
    const ctx1 = await ctxRepo.getContext();
    expect(ctx1.activeConnectionId).toBeNull();
    expect(ctx1.activeSchema).toBeNull();
  });
});

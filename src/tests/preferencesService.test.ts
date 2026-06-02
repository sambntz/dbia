import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PreferencesService } from '../application/services/PreferencesService.js';
import { SqliteContextRepository } from '../infrastructure/sqlite/SqliteContextRepository.js';
import { SqliteDatabase } from '../infrastructure/sqlite/SqliteDatabase.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('PreferencesService', () => {
  let sqliteDb: SqliteDatabase;
  let service: PreferencesService;

  beforeEach(async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbia-prefs-test-'));
    process.env.DBIA_DATA_DIR = tempDir;
    sqliteDb = new SqliteDatabase();
    const contextRepo = new SqliteContextRepository(sqliteDb);
    service = new PreferencesService(contextRepo);
  });

  afterEach(async () => {
    await sqliteDb.close();
    delete process.env.DBIA_DATA_DIR;
  });

  it('returns the default format on a fresh install', async () => {
    expect(await service.getOutputFormat()).toBe('plain');
  });

  it('persists a valid format and reads it back', async () => {
    await service.setOutputFormat('json');
    expect(await service.getOutputFormat()).toBe('json');

    await service.setOutputFormat('table');
    expect(await service.getOutputFormat()).toBe('table');

    await service.setOutputFormat('plain');
    expect(await service.getOutputFormat()).toBe('plain');
  });

  it('rejects an invalid format value', async () => {
    await expect(service.setOutputFormat('xml')).rejects.toThrow(
      /Invalid output format 'xml'/,
    );
    await expect(service.setOutputFormat('')).rejects.toThrow(/Invalid output format/);
  });

  it('resetOutputFormat removes the override and falls back to the default', async () => {
    await service.setOutputFormat('json');
    expect(await service.getOutputFormat()).toBe('json');

    await service.resetOutputFormat();
    expect(await service.getOutputFormat()).toBe('plain');
  });

  it('falls back to default if the stored value is garbage', async () => {
    // Directly write a bogus value via the context repository.
    const ctxRepo = (service as any).contextRepository as SqliteContextRepository;
    const ctx = await ctxRepo.getContext();
    ctx.preferences = { outputFormat: 'yaml-something' };
    await ctxRepo.saveContext(ctx);

    expect(await service.getOutputFormat()).toBe('plain');
  });

  it('does not clobber other preference keys when setting the format', async () => {
    const ctxRepo = (service as any).contextRepository as SqliteContextRepository;
    const ctx = await ctxRepo.getContext();
    ctx.preferences = { someOtherKey: 'keep-me' };
    await ctxRepo.saveContext(ctx);

    await service.setOutputFormat('json');

    const after = await ctxRepo.getContext();
    expect(after.preferences.outputFormat).toBe('json');
    expect(after.preferences.someOtherKey).toBe('keep-me');
  });
});

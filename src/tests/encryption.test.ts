import { describe, it, expect, beforeEach } from 'vitest';
import { EncryptionService } from '../application/services/EncryptionService.js';
import { SecretProvider } from '../domain/interfaces.js';
import * as crypto from 'crypto';

class MockSecretProvider implements SecretProvider {
  private readonly key: Buffer;

  constructor(key?: string) {
    this.key = crypto.createHash('sha256').update(key || 'test-master-key').digest();
  }

  async getMasterKey(): Promise<Buffer> {
    return this.key;
  }
}

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    service = new EncryptionService(new MockSecretProvider());
  });

  it('should encrypt and decrypt a string correctly', async () => {
    const original = 'my-super-secret-password-123';
    const encrypted = await service.encrypt(original);
    const decrypted = await service.decrypt(encrypted);

    expect(encrypted).not.toBe(original);
    expect(decrypted).toBe(original);
  });

  it('should produce different results for the same input (random IV)', async () => {
    const original = 'password';
    const encrypted1 = await service.encrypt(original);
    const encrypted2 = await service.encrypt(original);

    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should handle empty strings', async () => {
    expect(await service.encrypt('')).toBe('');
    expect(await service.decrypt('')).toBe('');
  });

  it('should use the same iv:tag:text format', async () => {
    const encrypted = await service.encrypt('test');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    // IV: 12 bytes in hex = 24 chars
    expect(parts[0]).toHaveLength(24);
    // AuthTag: 16 bytes in hex = 32 chars
    expect(parts[1]).toHaveLength(32);
  });

  it('should fail to decrypt with a different master key', async () => {
    const encrypted = await service.encrypt('secret');
    const otherService = new EncryptionService(
      new MockSecretProvider('another-different-key'),
    );
    await expect(otherService.decrypt(encrypted)).rejects.toThrow();
  });

  it('should fail to decrypt malformed text', async () => {
    await expect(service.decrypt('not-ciphertext')).rejects.toThrow();
    await expect(service.decrypt('a:b')).rejects.toThrow();
  });

  it('should decrypt correctly with the same key', async () => {
    const provider = new MockSecretProvider('shared-key');
    const serviceA = new EncryptionService(provider);
    const serviceB = new EncryptionService(provider);

    const encrypted = await serviceA.encrypt('data');
    const decrypted = await serviceB.decrypt(encrypted);
    expect(decrypted).toBe('data');
  });
});

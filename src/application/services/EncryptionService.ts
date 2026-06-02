import { SecretProvider } from '../../domain/interfaces.js';
import * as crypto from 'crypto';

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12; // 12 bytes is the standard for GCM

  constructor(private readonly secretProvider: SecretProvider) {}

  async encrypt(text: string): Promise<string> {
    if (!text) return '';
    const masterKey = await this.secretProvider.getMasterKey();
    const iv = crypto.randomBytes(EncryptionService.IV_LENGTH);
    const cipher = crypto.createCipheriv(EncryptionService.ALGORITHM, masterKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    // Return iv, authTag and ciphertext concatenated with colons
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  async decrypt(encryptedText: string): Promise<string> {
    if (!encryptedText) return '';

    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format. Expected 3 parts (iv:tag:text).');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const masterKey = await this.secretProvider.getMasterKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(EncryptionService.ALGORITHM, masterKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

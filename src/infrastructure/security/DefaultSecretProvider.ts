import { SecretProvider } from '../../domain/interfaces.js';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

export class DefaultSecretProvider implements SecretProvider {
  private static readonly KEY_FILE_DIR = path.join(os.homedir(), '.dbia');
  private static readonly KEY_FILE_PATH = path.join(DefaultSecretProvider.KEY_FILE_DIR, 'master.key');

  async getMasterKey(): Promise<Buffer> {
    // 1. Try to obtain from an environment variable
    const envKey = process.env.DBIA_MASTER_KEY;
    if (envKey) {
      return crypto.createHash('sha256').update(envKey).digest();
    }

    // 2. Try to read from a file in the user's home directory
    try {
      const fileKey = await fs.readFile(DefaultSecretProvider.KEY_FILE_PATH, 'utf8');
      return crypto.createHash('sha256').update(fileKey.trim()).digest();
    } catch {
      // 3. If it does not exist, generate a random key and store it for future use
      const randomKey = crypto.randomBytes(32).toString('hex');
      try {
        await fs.mkdir(DefaultSecretProvider.KEY_FILE_DIR, { recursive: true });
        await fs.writeFile(DefaultSecretProvider.KEY_FILE_PATH, randomKey, {
          encoding: 'utf8',
          mode: 0o600, // Read/write only for the file owner
        });
      } catch {
        // If it cannot be written (e.g. permissions), use a temporary key for the session
      }
      return crypto.createHash('sha256').update(randomKey).digest();
    }
  }
}

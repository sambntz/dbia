import { DatabaseDriver } from '../../domain/interfaces.js';
import { DatabaseType } from '../../domain/entities.js';
import { EncryptionService } from '../../application/services/EncryptionService.js';
import { MySqlDriver } from '../mysql/MySqlDriver.js';
import { PostgresDriver } from '../postgres/PostgresDriver.js';

export class DriverFactory {
  constructor(private readonly encryptionService: EncryptionService) {}

  createDriver(type: DatabaseType): DatabaseDriver {
    switch (type) {
      case 'mysql':
        return new MySqlDriver(this.encryptionService);
      case 'postgres':
        return new PostgresDriver(this.encryptionService);
      default:
        throw new Error(
          `Unsupported database type: ${type}. Supported types are 'mysql' and 'postgres'.`,
        );
    }
  }
}

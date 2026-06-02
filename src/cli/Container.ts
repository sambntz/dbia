import { SqliteDatabase } from '../infrastructure/sqlite/SqliteDatabase.js';
import { SqliteConnectionRepository } from '../infrastructure/sqlite/SqliteConnectionRepository.js';
import { SqliteContextRepository } from '../infrastructure/sqlite/SqliteContextRepository.js';
import { DefaultSecretProvider } from '../infrastructure/security/DefaultSecretProvider.js';
import { EncryptionService } from '../application/services/EncryptionService.js';
import { DriverFactory } from '../infrastructure/factories/DriverFactory.js';
import { ConnectionService } from '../application/services/ConnectionService.js';
import { IntrospectionService } from '../application/services/IntrospectionService.js';
import { PreferencesService } from '../application/services/PreferencesService.js';

export class Container {
  public readonly sqliteDb: SqliteDatabase;
  public readonly encryptionService: EncryptionService;
  public readonly driverFactory: DriverFactory;
  public readonly connectionService: ConnectionService;
  public readonly introspectionService: IntrospectionService;
  public readonly preferencesService: PreferencesService;

  constructor() {
    this.sqliteDb = new SqliteDatabase();

    const secretProvider = new DefaultSecretProvider();
    this.encryptionService = new EncryptionService(secretProvider);

    const connectionRepository = new SqliteConnectionRepository(this.sqliteDb);
    const contextRepository = new SqliteContextRepository(this.sqliteDb);

    this.driverFactory = new DriverFactory(this.encryptionService);
    this.connectionService = new ConnectionService(
      connectionRepository,
      contextRepository,
      this.encryptionService,
    );
    this.introspectionService = new IntrospectionService(
      connectionRepository,
      contextRepository,
      this.driverFactory,
    );
    this.preferencesService = new PreferencesService(contextRepository);
  }

  async close(): Promise<void> {
    await this.introspectionService.disconnect();
    await this.sqliteDb.close();
  }
}

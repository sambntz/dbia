import { randomUUID } from 'crypto';
import { ConnectionRepository, ContextRepository } from '../../domain/interfaces.js';
import { DatabaseConnection, DatabaseType } from '../../domain/entities.js';
import { EncryptionService } from './EncryptionService.js';

export interface CreateConnectionInput {
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  username: string;
  password: string;
  databaseName: string;
}

export class ConnectionService {
  constructor(
    private readonly connectionRepository: ConnectionRepository,
    private readonly contextRepository: ContextRepository,
    private readonly encryptionService: EncryptionService,
  ) {}

  async addConnection(input: CreateConnectionInput): Promise<DatabaseConnection> {
    // Verify no connection with the same name exists
    const existing = await this.connectionRepository.findByName(input.name);
    if (existing) {
      throw new Error(`A connection with the name '${input.name}' already exists.`);
    }

    const now = new Date().toISOString();
    const passwordEncrypted = await this.encryptionService.encrypt(input.password);

    const connection: DatabaseConnection = {
      id: randomUUID(),
      name: input.name,
      type: input.type,
      host: input.host,
      port: input.port,
      username: input.username,
      passwordEncrypted,
      databaseName: input.databaseName,
      createdAt: now,
      updatedAt: now,
    };

    await this.connectionRepository.save(connection);
    return connection;
  }

  async listConnections(): Promise<DatabaseConnection[]> {
    return this.connectionRepository.findAll();
  }

  async showConnection(nameOrId: string): Promise<DatabaseConnection> {
    return this.findConnection(nameOrId);
  }

  async removeConnection(nameOrId: string): Promise<void> {
    const connection = await this.findConnection(nameOrId);

    // Read the active id BEFORE deleting, because the connections table has
    // ON DELETE SET NULL on context.active_connection_id, so a post-delete
    // read would already see null and we'd skip the cleanup.
    const context = await this.contextRepository.getContext();
    const wasActive = context.activeConnectionId === connection.id;

    await this.connectionRepository.delete(connection.id);

    if (wasActive) {
      context.activeConnectionId = null;
      context.activeDatabase = null;
      context.activeSchema = null;
      await this.contextRepository.saveContext(context);
    }
  }

  async renameConnection(nameOrId: string, newName: string): Promise<DatabaseConnection> {
    const trimmedNewName = newName.trim();
    if (trimmedNewName.length === 0) {
      throw new Error('The new name cannot be empty.');
    }

    const connection = await this.findConnection(nameOrId);

    if (connection.name === trimmedNewName) {
      throw new Error(`The connection is already named '${trimmedNewName}'.`);
    }

    const conflict = await this.connectionRepository.findByName(trimmedNewName);
    if (conflict && conflict.id !== connection.id) {
      throw new Error(`A connection with the name '${trimmedNewName}' already exists.`);
    }

    connection.name = trimmedNewName;
    connection.updatedAt = new Date().toISOString();
    await this.connectionRepository.save(connection);
    return connection;
  }

  async useConnection(nameOrId: string): Promise<DatabaseConnection> {
    const connection = await this.findConnection(nameOrId);
    const context = await this.contextRepository.getContext();
    context.activeConnectionId = connection.id;
    // Reset the active database to the new connection's default. Otherwise a
    // database name from the previous connection would be carried over and
    // the driver would try to open a database that does not exist on the
    // new connection (e.g. "Unknown database 'loyalty'" after switching).
    context.activeDatabase = connection.databaseName;
    // Same reasoning for the schema: the new connection (especially across
    // different PG instances) is unlikely to have the same custom schema.
    context.activeSchema = null;
    await this.contextRepository.saveContext(context);
    return connection;
  }

  async getCurrentConnection(): Promise<DatabaseConnection | null> {
    const context = await this.contextRepository.getContext();
    if (!context.activeConnectionId) {
      return null;
    }
    return this.connectionRepository.findById(context.activeConnectionId);
  }

  private async findConnection(nameOrId: string): Promise<DatabaseConnection> {
    let connection: DatabaseConnection | null = null;
    // Try to look up by name first (most common case)
    connection = await this.connectionRepository.findByName(nameOrId);
    if (!connection) {
      // If not found by name, try by ID
      connection = await this.connectionRepository.findById(nameOrId);
    }
    if (!connection) {
      throw new Error(`No connection with the identifier '${nameOrId}' was found.`);
    }
    return connection;
  }
}

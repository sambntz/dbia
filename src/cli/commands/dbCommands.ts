import { Command } from 'commander';
import pc from 'picocolors';
import { Container } from '../Container.js';
import { Logger } from '../../shared/utils/logger.js';
import { Renderer } from '../../shared/formatters/Renderer.js';

export function registerDbCommands(program: Command, container: Container): void {
  const dbCmd = program
    .command('db')
    .alias('d')
    .description('Manage databases within the active connection');

  // dbia db list (alias: ls)
  dbCmd
    .command('list')
    .alias('ls')
    .description('List available databases')
    .action(async () => {
      try {
        const databases = await container.introspectionService.listDatabases();
        const current = await container.introspectionService.getCurrentDatabase();

        if (databases.length === 0) {
          Renderer.printEmpty();
          Logger.info('No databases found.');
          return;
        }

        const isMachine = Renderer.isMachineReadable();
        const headers = ['active', 'name'];
        const rows = databases.map((name) => [
          current === name ? (isMachine ? '*' : pc.green('●')) : '',
          name,
        ]);

        Renderer.printTable(headers, rows);
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });

  // dbia db use (alias: u)
  dbCmd
    .command('use <name>')
    .alias('u')
    .description('Select the active database')
    .action(async (name) => {
      try {
        await container.introspectionService.useDatabase(name);
        Logger.success(`Active database: ${pc.bold(name)}`);
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });

  // dbia db current (alias: cur)
  dbCmd
    .command('current')
    .alias('cur')
    .description('Show the active database')
    .action(async () => {
      try {
        const current = await container.introspectionService.getCurrentDatabase();
        if (!current) {
          if (Renderer.getFormat() === 'json') {
            Renderer.printJson(null);
          }
          Logger.info('No active database. Use "dbia db use <name>".');
          return;
        }
        Renderer.printPairs([['name', current]]);
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });

  // dbia db schema — PostgreSQL only. For MySQL the driver throws a clear error.
  const schemaCmd = dbCmd
    .command('schema')
    .alias('sch')
    .description('Manage schemas within the active database (PostgreSQL)');

  // dbia db schema list (alias: ls)
  schemaCmd
    .command('list')
    .alias('ls')
    .description('List available schemas in the active database')
    .action(async () => {
      try {
        const currentConnection = await container.connectionService.getCurrentConnection();
        if (!currentConnection) {
          if (Renderer.getFormat() === 'json') {
            Renderer.printEmpty();
          }
          Logger.info('No active connection. Use "dbia connection use <name>".');
          return;
        }

        const schemas = await container.introspectionService.listSchemas();
        const current = await container.introspectionService.getCurrentSchema();

        if (schemas.length === 0) {
          Renderer.printEmpty();
          Logger.info('No schemas found.');
          return;
        }

        const isMachine = Renderer.isMachineReadable();
        const headers = ['active', 'schema'];
        const rows = schemas.map((name) => [
          current === name ? (isMachine ? '*' : pc.green('●')) : '',
          name,
        ]);

        Renderer.printTable(headers, rows);
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });

  // dbia db schema use (alias: u)
  schemaCmd
    .command('use <name>')
    .alias('u')
    .description('Select the active schema')
    .action(async (name) => {
      try {
        await container.introspectionService.useSchema(name);
        Logger.success(`Active schema: ${pc.bold(name)}`);
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });

  // dbia db schema current (alias: cur)
  schemaCmd
    .command('current')
    .alias('cur')
    .description('Show the active schema')
    .action(async () => {
      try {
        const current = await container.introspectionService.getCurrentSchema();
        if (!current) {
          if (Renderer.getFormat() === 'json') {
            Renderer.printJson(null);
          }
          Logger.info('No active schema. Use "dbia db schema use <name>".');
          return;
        }
        Renderer.printPairs([['schema', current]]);
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });
}

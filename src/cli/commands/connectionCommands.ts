import { Command } from 'commander';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { Container } from '../Container.js';
import { Logger } from '../../shared/utils/logger.js';
import { Renderer } from '../../shared/formatters/Renderer.js';
import { DatabaseType } from '../../domain/entities.js';

export function registerConnectionCommands(program: Command, container: Container): void {
  const connectionCmd = program
    .command('connection')
    .alias('c')
    .description('Manage database connections');

  // dbia connection add (alias: a)
  connectionCmd
    .command('add')
    .alias('a')
    .description('Create a new connection')
    .option('-n, --name <name>', 'Connection name')
    .option('-t, --type <type>', 'Database type (mysql, postgres)')
    .option('-h, --host <host>', 'Database host')
    .option('-p, --port <port>', 'Database port', (val) => parseInt(val, 10))
    .option('-u, --user <user>', 'Database user')
    .option('-w, --password <password>', 'Password (not recommended, better to use interactive prompt)')
    .option('-d, --database <database>', 'Default database')
    .action(async (options) => {
      try {
        // Name
        let name = options.name;
        if (!name) {
          const ans = await p.text({
            message: 'Connection name:',
            validate: (v) => (v.length > 0 ? undefined : 'Name is required'),
          });
          if (p.isCancel(ans)) {
            p.cancel('Operation cancelled');
            return;
          }
          name = ans as string;
        }

        // Type
        let type = options.type as DatabaseType;
        if (!type) {
          const ans = await p.select({
            message: 'Database type:',
            options: [
              { value: 'mysql', label: 'MySQL' },
              { value: 'postgres', label: 'PostgreSQL' },
            ],
          });
          if (p.isCancel(ans)) {
            p.cancel('Operation cancelled');
            return;
          }
          type = ans as DatabaseType;
        } else if (type !== 'mysql' && type !== 'postgres') {
          throw new Error(`Unsupported database type: ${type}`);
        }

        // Host
        let host = options.host;
        if (!host) {
          const ans = await p.text({
            message: 'Host:',
            initialValue: 'localhost',
          });
          if (p.isCancel(ans)) {
            p.cancel('Operation cancelled');
            return;
          }
          host = ans as string;
        }

        // Port
        let port = options.port;
        if (!port) {
          const ans = await p.text({
            message: 'Port:',
            initialValue: String(type === 'mysql' ? 3306 : 5432),
            validate: (v) => (!isNaN(parseInt(v, 10)) ? undefined : 'Invalid port'),
          });
          if (p.isCancel(ans)) {
            p.cancel('Operation cancelled');
            return;
          }
          port = parseInt(ans as string, 10);
        }

        // User
        let username = options.user;
        if (!username) {
          const ans = await p.text({
            message: 'User:',
            initialValue: 'root',
          });
          if (p.isCancel(ans)) {
            p.cancel('Operation cancelled');
            return;
          }
          username = ans as string;
        }

        // Password (always prompted interactively, unless --password is explicitly passed)
        let password = options.password;
        if (!password) {
          const ans = await p.password({
            message: 'Password:',
            validate: (v) => (v.length > 0 ? undefined : 'Password is required'),
          });
          if (p.isCancel(ans)) {
            p.cancel('Operation cancelled');
            return;
          }
          password = ans as string;
        }

        // Default database
        let databaseName = options.database;
        if (!databaseName) {
          const ans = await p.text({
            message: 'Default database:',
            initialValue: type === 'mysql' ? 'mysql' : 'postgres',
          });
          if (p.isCancel(ans)) {
            p.cancel('Operation cancelled');
            return;
          }
          databaseName = ans as string;
        }

        await container.connectionService.addConnection({
          name,
          type,
          host,
          port,
          username,
          password,
          databaseName,
        });

        Logger.success(`Connection '${pc.bold(name)}' created successfully.`);
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });

  // dbia connection list (alias: ls)
  connectionCmd
    .command('list')
    .alias('ls')
    .description('List all connections')
    .action(async () => {
      try {
        const connections = await container.connectionService.listConnections();
        const current = await container.connectionService.getCurrentConnection();

        if (connections.length === 0) {
          Renderer.printEmpty();
          Logger.info('No connections registered. Use "dbia connection add" to create one.');
          return;
        }

        const isMachine = Renderer.isMachineReadable();
        const headers = ['active', 'name', 'type', 'host', 'port', 'user', 'database'];
        const rows = connections.map((c) => {
          const isActive = !!(current && current.id === c.id);
          return [
            isActive ? (isMachine ? '*' : pc.green('●')) : '',
            c.name,
            c.type,
            c.host,
            c.port,
            c.username,
            c.databaseName,
          ];
        });

        Renderer.printTable(headers, rows);
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });

  // dbia connection show (alias: v)
  connectionCmd
    .command('show <name>')
    .alias('v')
    .description('Show details of a connection')
    .action(async (name) => {
      try {
        const conn = await container.connectionService.showConnection(name);
        const current = await container.connectionService.getCurrentConnection();
        const isActive = !!(current && current.id === conn.id);

        const pairs: [string, any][] = [
          ['name', conn.name],
          ['active', isActive],
          ['type', conn.type],
          ['host', conn.host],
          ['port', conn.port],
          ['user', conn.username],
          ['password', '******** (encrypted)'],
          ['database', conn.databaseName],
          ['createdAt', conn.createdAt],
          ['updatedAt', conn.updatedAt],
        ];

        Renderer.printPairs(pairs);
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });

  // dbia connection remove (alias: rm)
  connectionCmd
    .command('remove <name>')
    .alias('rm')
    .description('Remove a connection')
    .action(async (name) => {
      try {
        const conn = await container.connectionService.showConnection(name);
        const confirm = await p.confirm({
          message: `Are you sure you want to remove the connection '${conn.name}'?`,
        });
        if (p.isCancel(confirm) || !confirm) {
          p.cancel('Operation cancelled');
          return;
        }
        await container.connectionService.removeConnection(name);
        Logger.success(`Connection '${pc.bold(name)}' removed.`);
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });

  // dbia connection rename (alias: mv)
  connectionCmd
    .command('rename <oldName> <newName>')
    .alias('mv')
    .description('Rename a connection')
    .action(async (oldName, newName) => {
      try {
        const updated = await container.connectionService.renameConnection(oldName, newName);
        Logger.success(
          `Connection renamed: ${pc.bold(oldName)} → ${pc.bold(updated.name)}`,
        );
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });

  // dbia connection use (alias: u)
  connectionCmd
    .command('use <name>')
    .alias('u')
    .description('Select the active connection')
    .action(async (name) => {
      try {
        const conn = await container.connectionService.useConnection(name);
        Logger.success(`Active connection: ${pc.bold(conn.name)} (${conn.type})`);
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });

  // dbia connection current (alias: cur)
  connectionCmd
    .command('current')
    .alias('cur')
    .description('Show the active connection')
    .action(async () => {
      try {
        const conn = await container.connectionService.getCurrentConnection();
        if (!conn) {
          if (Renderer.getFormat() === 'json') {
            Renderer.printJson(null);
          }
          Logger.info('No active connection. Use "dbia connection use <name>".');
          return;
        }
        Renderer.printPairs([
          ['name', conn.name],
          ['type', conn.type],
          ['host', conn.host],
          ['port', conn.port],
          ['user', conn.username],
          ['database', conn.databaseName],
        ]);
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });
}

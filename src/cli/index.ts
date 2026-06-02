#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import pc from 'picocolors';
import { Container } from './Container.js';
import { Logger } from '../shared/utils/logger.js';
import { Renderer } from '../shared/formatters/Renderer.js';
import { registerConnectionCommands } from './commands/connectionCommands.js';
import { registerDbCommands } from './commands/dbCommands.js';
import { registerTableCommands } from './commands/tableCommands.js';
import { registerIntrospectionCommands } from './commands/introspectionCommands.js';
import { registerQueryCommands } from './commands/queryCommands.js';
import { registerConfigCommands } from './commands/configCommands.js';

async function main(): Promise<void> {
  const program = new Command();
  const container = new Container();

  // Load the persisted output format BEFORE registering commands so that
  // every Renderer/Logger call below uses the user's preference.
  try {
    const format = await container.preferencesService.getOutputFormat();
    Renderer.setFormat(format);
    Logger.setMachineReadable(format !== 'table');
  } catch {
    // If the SQLite store cannot be read yet (e.g. very first run, fs
    // permission hiccup), fall back to the built-in default. The actual
    // command will surface the real error later.
  }

  program
    .name('dbia')
    .description(
      pc.bold('DBIA') +
        ' (Database Introspection Assistant) - CLI tool to introspect databases.',
    )
    .version('1.0.0');

  // Register all commands
  registerConnectionCommands(program, container);
  registerDbCommands(program, container);
  registerTableCommands(program, container);
  registerIntrospectionCommands(program, container);
  registerQueryCommands(program, container);
  registerConfigCommands(program, container);

  // Handle uncaught errors
  program.showHelpAfterError();

  try {
    await program.parseAsync(process.argv);
  } catch (error: any) {
    Logger.error(error.message || 'An unexpected error occurred.');
    process.exitCode = 1;
  } finally {
    await container.close();
  }
}

main();

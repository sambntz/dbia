import { Command } from 'commander';
import pc from 'picocolors';
import { Container } from '../Container.js';
import { Logger } from '../../shared/utils/logger.js';
import { Renderer } from '../../shared/formatters/Renderer.js';
import { OUTPUT_FORMATS, DEFAULT_OUTPUT_FORMAT } from '../../domain/entities.js';

export function registerConfigCommands(program: Command, container: Container): void {
  const configCmd = program
    .command('config')
    .alias('cfg')
    .description('Manage CLI configuration (persisted in the local SQLite store)');

  // dbia config format [value]
  //   - no argument        → show the current output format
  //   - <plain|json|table> → set the persistent output format
  configCmd
    .command('format [value]')
    .alias('fmt')
    .description(
      `Get or set the default output format. Valid values: ${OUTPUT_FORMATS.join(', ')}. ` +
        `Default: ${DEFAULT_OUTPUT_FORMAT}.`,
    )
    .action(async (value?: string) => {
      try {
        if (!value) {
          const current = await container.preferencesService.getOutputFormat();
          // Always emit the bare value on stdout so it is trivially
          // capturable in scripts: `FORMAT=$(dbia config format)`.
          process.stdout.write(current + '\n');
          return;
        }

        const applied = await container.preferencesService.setOutputFormat(value);
        // Reflect the change for the rest of this invocation too, so the
        // success message uses the new mode's conventions.
        Renderer.setFormat(applied);
        Logger.setMachineReadable(applied !== 'table');
        Logger.success(`Output format set to ${pc.bold(applied)}.`);
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });

  // dbia config reset (alias: rst)
  configCmd
    .command('reset')
    .alias('rst')
    .description('Reset the output format to the default (plain)')
    .action(async () => {
      try {
        await container.preferencesService.resetOutputFormat();
        Renderer.setFormat(DEFAULT_OUTPUT_FORMAT);
        Logger.setMachineReadable(DEFAULT_OUTPUT_FORMAT !== 'table');
        Logger.success(`Output format reset to ${pc.bold(DEFAULT_OUTPUT_FORMAT)}.`);
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });
}

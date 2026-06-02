import { Command } from 'commander';
import { Container } from '../Container.js';
import { Logger } from '../../shared/utils/logger.js';
import { Renderer } from '../../shared/formatters/Renderer.js';
import { OutputFormatter } from '../../shared/formatters/OutputFormatter.js';

export function registerQueryCommands(program: Command, container: Container): void {
  program
    .command('query <sql>')
    .alias('q')
    .description('Execute a SQL query on the active database')
    .option('--json', 'Force JSON output for this invocation (overrides config)')
    .option('--csv', 'Force CSV output for this invocation (overrides config)')
    .option('--limit <n>', 'Limit the number of rows shown (default: 50)', (v) => parseInt(v, 10))
    .action(async (sql, options) => {
      try {
        const rows = await container.introspectionService.executeQuery(sql);
        const limit = options.limit ?? 50;
        const displayRows = rows.slice(0, limit);
        const truncated = rows.length > limit;

        if (rows.length === 0) {
          // Honor the format for an empty result too.
          if (options.json || Renderer.getFormat() === 'json') {
            Renderer.printJson([]);
          } else if (options.csv) {
            // CSV with no rows is just an empty string; nothing to emit.
          }
          Logger.info('The query executed but returned no results.');
          return;
        }

        // Per-command overrides (legacy --json / --csv flags) take precedence
        // over the persistent config so existing scripts keep working.
        if (options.json) {
          process.stdout.write(OutputFormatter.toJson(displayRows) + '\n');
        } else if (options.csv) {
          Renderer.printCsv(displayRows);
        } else {
          Renderer.printRows(displayRows);
        }

        if (truncated) {
          Logger.warn(
            `Showing the first ${limit} rows of ${rows.length}. Use --limit to see more.`,
          );
        }
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });
}

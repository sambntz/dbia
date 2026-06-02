import { Command } from 'commander';
import pc from 'picocolors';
import { Container } from '../Container.js';
import { Logger } from '../../shared/utils/logger.js';
import { Renderer } from '../../shared/formatters/Renderer.js';

export function registerIntrospectionCommands(program: Command, container: Container): void {
  // dbia schema
  program
    .command('schema')
    .alias('sch')
    .description('Show the full schema of the active database')
    .action(async () => {
      try {
        const schema = await container.introspectionService.getSchema();
        if (schema.tables.length === 0) {
          Renderer.printEmpty();
          Logger.info('The database contains no tables.');
          return;
        }

        // JSON mode: dump the full schema as a single structured object.
        if (Renderer.getFormat() === 'json') {
          Renderer.printJson({
            tables: schema.tables.map((t) => ({
              name: t.name,
              columns: t.columns,
              indexes: t.indexes,
              foreignKeys: t.foreignKeys,
            })),
          });
          return;
        }

        const isMachine = Renderer.isMachineReadable();

        Renderer.section(
          isMachine
            ? `# Schema (${schema.tables.length} tables)`
            : pc.bold(pc.cyan(`Schema (${schema.tables.length} tables)`)),
        );
        Renderer.blank();

        for (const table of schema.tables) {
          Renderer.section(
            isMachine ? `# ${table.name}` : pc.bold(pc.yellow(`▸ ${table.name}`)),
          );
          const colHeaders = ['column', 'type', 'null', 'pk', 'fk', 'default'];
          const colRows = table.columns.map((c) => {
            const fk = table.foreignKeys.find((f) => f.columnName === c.name);
            return [
              c.name,
              c.type,
              c.nullable ? 'yes' : 'no',
              c.isPrimaryKey ? (isMachine ? '*' : pc.green('✓')) : '',
              fk ? `${fk.referencedTableName}.${fk.referencedColumnName}` : '',
              c.defaultValue ?? '',
            ];
          });
          Renderer.printTable(colHeaders, colRows);
          Renderer.blank();
        }
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });

  // dbia relations
  program
    .command('relations')
    .alias('rel')
    .description('Show all relations (Foreign Keys) of the database')
    .action(async () => {
      try {
        const relations = await container.introspectionService.getRelations();
        if (relations.length === 0) {
          Renderer.printEmpty();
          Logger.info('No relations found.');
          return;
        }
        const headers = ['constraint', 'source_column', 'references_table', 'references_column'];
        const rows = relations.map((r) => [
          r.constraintName,
          r.columnName,
          r.referencedTableName,
          r.referencedColumnName,
        ]);
        Renderer.printTable(headers, rows);
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });

  // dbia search
  program
    .command('search <query>')
    .alias('s')
    .description('Search tables by name')
    .action(async (query) => {
      try {
        const results = await container.introspectionService.searchTables(query);
        if (results.length === 0) {
          Renderer.printEmpty();
          Logger.info(`No tables matching '${query}' were found.`);
          return;
        }
        const headers = ['#', 'name'];
        const rows = results.map((t, i) => [i + 1, t]);
        Renderer.printTable(headers, rows);
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });
}

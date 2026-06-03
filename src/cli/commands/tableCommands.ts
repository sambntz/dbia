import { Command } from 'commander';
import pc from 'picocolors';
import { Container } from '../Container.js';
import { Logger } from '../../shared/utils/logger.js';
import { Renderer } from '../../shared/formatters/Renderer.js';

export function registerTableCommands(program: Command, container: Container): void {
  // dbia table list (alias: ls)
  const tableCmd = program
    .command('table')
    .alias('t')
    .description('Table operations');

  tableCmd
    .command('list')
    .alias('ls')
    .description('List all tables in the active database')
    .action(async () => {
      try {
        const tables = await container.introspectionService.listTables();
        if (tables.length === 0) {
          Renderer.printEmpty();
          Logger.info('No tables found.');
          return;
        }
        const headers = ['#', 'name'];
        const rows = tables.map((t, i) => [i + 1, t]);
        Renderer.printTable(headers, rows);
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });

  // dbia table show (alias: v)
  tableCmd
    .command('show <name>')
    .alias('v')
    .description('Show details (columns, indexes, FKs) of a table')
    .action(async (name) => {
      try {
        const table = await container.introspectionService.showTable(name);

        // JSON mode: dump the full Table entity as a single object so the
        // output stays parseable in one shot.
        if (Renderer.getFormat() === 'json') {
          Renderer.printJson({
            name: table.name,
            columns: table.columns,
            indexes: table.indexes,
            foreignKeys: table.foreignKeys,
          });
          return;
        }

        const isMachine = Renderer.isMachineReadable();

        Renderer.blank();
        Renderer.section(
          isMachine ? `# Table: ${table.name}` : pc.bold(pc.cyan(`Table: ${table.name}`)),
        );
        Renderer.blank();

        // Columns
        Renderer.section(isMachine ? '# Columns' : pc.bold('Columns:'));
        const colHeaders = ['name', 'type', 'nullable', 'pk', 'default'];
        const colRows = table.columns.map((c) => [
          c.name,
          c.type,
          c.nullable ? 'yes' : 'no',
          c.isPrimaryKey ? (isMachine ? '*' : pc.green('✓')) : '',
          c.defaultValue ?? '',
        ]);
        Renderer.printTable(colHeaders, colRows);

        // Indexes
        if (table.indexes.length > 0) {
          Renderer.blank();
          Renderer.section(isMachine ? '# Indexes' : pc.bold('Indexes:'));
          const idxHeaders = ['name', 'columns', 'unique'];
          const idxRows = table.indexes.map((i) => [
            i.name,
            i.columns.join(', '),
            i.unique ? (isMachine ? 'yes' : pc.green('Yes')) : 'no',
          ]);
          Renderer.printTable(idxHeaders, idxRows);
        }

        // Foreign Keys
        if (table.foreignKeys.length > 0) {
          Renderer.blank();
          Renderer.section(isMachine ? '# Foreign Keys' : pc.bold('Foreign Keys:'));
          const fkHeaders = ['constraint', 'column', 'references_table', 'references_column'];
          const fkRows = table.foreignKeys.map((fk) => [
            fk.constraintName,
            fk.columnName,
            fk.referencedTableName,
            fk.referencedColumnName,
          ]);
          Renderer.printTable(fkHeaders, fkRows);
        }
      } catch (error: any) {
        Logger.error(error.message);
        process.exitCode = 1;
      }
    });
}

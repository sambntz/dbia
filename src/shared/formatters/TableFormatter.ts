import Table from 'cli-table3';
import pc from 'picocolors';

export class TableFormatter {
  static render(headers: string[], rows: any[][]): string {
    const table = new Table({
      head: headers.map((h) => pc.cyan(pc.bold(h))),
      style: {
        head: [],
        border: [],
      },
    });

    for (const row of rows) {
      table.push(row.map((cell) => (cell === null ? pc.dim('NULL') : String(cell))));
    }

    return table.toString();
  }

  static renderWithColor(headers: string[], rows: any[][]): string {
    const table = new Table({
      head: headers.map((h) => pc.cyan(pc.bold(h))),
      style: {
        head: [],
        border: ['gray'],
      },
    });

    for (const row of rows) {
      table.push(row.map((cell) => (cell === null ? pc.dim('NULL') : String(cell))));
    }

    return table.toString();
  }
}

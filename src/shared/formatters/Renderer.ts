import { DEFAULT_OUTPUT_FORMAT, OutputFormat } from '../../domain/entities.js';
import { TableFormatter } from './TableFormatter.js';
import { PlainFormatter } from './PlainFormatter.js';
import { OutputFormatter } from './OutputFormatter.js';

/**
 * Central renderer. Picks the right formatter according to the current
 * output format (set once at CLI startup from user preferences).
 *
 * All data output goes through this class so that switching `--format`
 * (eventually) or the persistent config affects every command uniformly.
 *
 * - `table`  → pretty cli-table3 with colors (legacy default, human terminal).
 * - `plain`  → TSV with header line, no ANSI, no decorations (AI / pipes).
 * - `json`   → JSON arrays/objects, no ANSI (machine consumption).
 */
export class Renderer {
  private static currentFormat: OutputFormat = DEFAULT_OUTPUT_FORMAT;

  static setFormat(format: OutputFormat): void {
    Renderer.currentFormat = format;
  }

  static getFormat(): OutputFormat {
    return Renderer.currentFormat;
  }

  static isMachineReadable(): boolean {
    return Renderer.currentFormat === 'plain' || Renderer.currentFormat === 'json';
  }

  /**
   * Render a tabular result (column headers + array of row arrays).
   * In JSON mode each row is zipped with the headers into an object.
   */
  static printTable(headers: string[], rows: any[][]): void {
    switch (Renderer.currentFormat) {
      case 'json': {
        const records = rows.map((row) =>
          Object.fromEntries(
            headers.map((h, i) => [PlainFormatter.stripAnsi(h), Renderer.normalizeValue(row[i])]),
          ),
        );
        process.stdout.write(OutputFormatter.toJson(records) + '\n');
        return;
      }
      case 'plain':
        process.stdout.write(PlainFormatter.render(headers, rows) + '\n');
        return;
      case 'table':
      default:
        process.stdout.write(TableFormatter.render(headers, rows) + '\n');
        return;
    }
  }

  /**
   * Render an array of records (used by query results, where the column
   * set comes from the row objects themselves).
   */
  static printRows(rows: Record<string, any>[]): void {
    if (rows.length === 0) {
      Renderer.printEmpty();
      return;
    }
    if (Renderer.currentFormat === 'json') {
      process.stdout.write(OutputFormatter.toJson(rows) + '\n');
      return;
    }
    const headers = Object.keys(rows[0]);
    const matrix = rows.map((row) =>
      headers.map((h) => {
        const v = row[h];
        if (v === null || v === undefined) return null;
        if (typeof v === 'object') return JSON.stringify(v);
        return v;
      }),
    );
    Renderer.printTable(headers, matrix);
  }

  /**
   * Render a single object presented as `[key, value]` pairs.
   * Used by "show" style commands (connection show, db current, etc.).
   */
  static printPairs(pairs: [string, any][]): void {
    switch (Renderer.currentFormat) {
      case 'json': {
        const obj: Record<string, any> = {};
        for (const [k, v] of pairs) {
          obj[PlainFormatter.stripAnsi(k)] = Renderer.normalizeValue(v);
        }
        process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
        return;
      }
      case 'plain':
        process.stdout.write(PlainFormatter.renderPairs(pairs) + '\n');
        return;
      case 'table':
      default:
        process.stdout.write(TableFormatter.render(['Field', 'Value'], pairs) + '\n');
        return;
    }
  }

  /**
   * Print a raw JSON value. Only meant to be called when commands
   * compose their own structured payload (e.g. `table show`, `schema`)
   * for JSON mode. Caller must guard on `Renderer.getFormat() === 'json'`.
   */
  static printJson(value: any): void {
    process.stdout.write(JSON.stringify(value, null, 2) + '\n');
  }

  /**
   * Print a CSV blob. Caller composes the rows; CSV is exposed because
   * `query --csv` is a pre-existing per-command flag.
   */
  static printCsv(rows: Record<string, any>[]): void {
    process.stdout.write(OutputFormatter.toCsv(rows) + '\n');
  }

  /**
   * Print a section heading (e.g. "Columns:" inside `table show`).
   * Suppressed in JSON mode; emitted plainly in plain mode; bolded in
   * table mode. Always goes to stdout because it precedes data on stdout.
   */
  static section(title: string): void {
    if (Renderer.currentFormat === 'json') return;
    process.stdout.write(title + '\n');
  }

  /**
   * Print a blank line separator. No-op in JSON mode.
   */
  static blank(): void {
    if (Renderer.currentFormat === 'json') return;
    process.stdout.write('\n');
  }

  /**
   * Handle the "no rows" case for tabular output in a format-aware way:
   * - json: print `[]` to stdout (so stdout is still valid JSON).
   * - plain: print nothing to stdout (caller may emit an info message to stderr).
   * - table: print nothing to stdout (caller may emit an info message to stdout).
   */
  static printEmpty(): void {
    if (Renderer.currentFormat === 'json') {
      process.stdout.write('[]\n');
    }
  }

  private static normalizeValue(value: any): any {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return PlainFormatter.stripAnsi(value);
    if (typeof value === 'object') return value;
    return value;
  }
}

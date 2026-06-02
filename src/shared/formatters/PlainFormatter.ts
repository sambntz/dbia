// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

export class PlainFormatter {
  static stripAnsi(value: string): string {
    return value.replace(ANSI_REGEX, '');
  }

  private static cellToString(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  private static sanitize(value: any): string {
    const raw = PlainFormatter.cellToString(value);
    const stripped = PlainFormatter.stripAnsi(raw);
    // TSV must stay on one line and not contain tabs.
    return stripped.replace(/\r?\n/g, ' ').replace(/\t/g, ' ');
  }

  /**
   * Renders a tabular dataset as TSV with a header line.
   * Header line is `h1\th2\t...\n`, each data row is `v1\tv2\t...\n`.
   * Values containing tabs or newlines are flattened to spaces so a row
   * always fits on a single line and remains trivially parseable
   * (split on `\t` to get columns, split on `\n` to get rows).
   */
  static render(headers: string[], rows: any[][]): string {
    const headerLine = headers.map((h) => PlainFormatter.sanitize(h)).join('\t');
    if (rows.length === 0) {
      return headerLine;
    }
    const dataLines = rows
      .map((row) => row.map((cell) => PlainFormatter.sanitize(cell)).join('\t'))
      .join('\n');
    return `${headerLine}\n${dataLines}`;
  }

  /**
   * Renders a list of `[key, value]` pairs as `key\tvalue` lines (one per pair).
   * Used by "show" style commands that present a single object.
   */
  static renderPairs(pairs: [string, any][]): string {
    return pairs
      .map(([k, v]) => `${PlainFormatter.sanitize(k)}\t${PlainFormatter.sanitize(v)}`)
      .join('\n');
  }
}

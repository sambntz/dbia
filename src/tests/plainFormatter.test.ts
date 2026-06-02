import { describe, it, expect } from 'vitest';
import { PlainFormatter } from '../shared/formatters/PlainFormatter.js';

describe('PlainFormatter', () => {
  describe('stripAnsi', () => {
    it('removes color escape sequences', () => {
      // \x1b[32m green ... \x1b[39m default-color
      const input = '\x1b[32m●\x1b[39m';
      expect(PlainFormatter.stripAnsi(input)).toBe('●');
    });

    it('handles plain strings unchanged', () => {
      expect(PlainFormatter.stripAnsi('hello world')).toBe('hello world');
    });

    it('strips multiple consecutive sequences', () => {
      const input = '\x1b[1m\x1b[31mbold red\x1b[0m';
      expect(PlainFormatter.stripAnsi(input)).toBe('bold red');
    });
  });

  describe('render (TSV)', () => {
    it('emits a header line and a row line separated by \\n, columns by \\t', () => {
      const out = PlainFormatter.render(['a', 'b'], [['1', '2']]);
      expect(out).toBe('a\tb\n1\t2');
    });

    it('emits only the header when there are no rows', () => {
      const out = PlainFormatter.render(['a', 'b'], []);
      expect(out).toBe('a\tb');
    });

    it('strips ANSI from headers and cells', () => {
      const out = PlainFormatter.render(
        ['\x1b[32mactive\x1b[39m', 'name'],
        [['\x1b[32m●\x1b[39m', 'foo']],
      );
      expect(out).toBe('active\tname\n●\tfoo');
    });

    it('replaces embedded tabs and newlines with spaces so rows stay on one line', () => {
      const out = PlainFormatter.render(
        ['name', 'value'],
        [['x', 'line1\nline2\twith\ttabs']],
      );
      expect(out).toBe('name\tvalue\nx\tline1 line2 with tabs');
    });

    it('renders null/undefined as empty strings', () => {
      const out = PlainFormatter.render(['a', 'b'], [[null, undefined]]);
      expect(out).toBe('a\tb\n\t');
    });

    it('handles multiple rows', () => {
      const out = PlainFormatter.render(['id', 'name'], [[1, 'A'], [2, 'B']]);
      expect(out).toBe('id\tname\n1\tA\n2\tB');
    });

    it('serializes object cells as JSON', () => {
      const out = PlainFormatter.render(['data'], [[{ x: 1 }]]);
      expect(out).toBe('data\n{"x":1}');
    });
  });

  describe('renderPairs', () => {
    it('emits one key\\tvalue per line', () => {
      const out = PlainFormatter.renderPairs([
        ['name', 'foo'],
        ['port', 3306],
      ]);
      expect(out).toBe('name\tfoo\nport\t3306');
    });

    it('strips ANSI from keys and values', () => {
      const out = PlainFormatter.renderPairs([
        ['name', '\x1b[1mbar\x1b[0m'],
      ]);
      expect(out).toBe('name\tbar');
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Renderer } from '../shared/formatters/Renderer.js';

describe('Renderer', () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    Renderer.setFormat('plain'); // reset to default for next test
  });

  const captured = (): string => stdoutSpy.mock.calls.map((c) => c[0]).join('');

  describe('format state', () => {
    it('defaults to plain', () => {
      // Note: previous tests may have changed it; explicit setFormat below
      Renderer.setFormat('plain');
      expect(Renderer.getFormat()).toBe('plain');
      expect(Renderer.isMachineReadable()).toBe(true);
    });

    it('isMachineReadable is true for plain and json, false for table', () => {
      Renderer.setFormat('plain');
      expect(Renderer.isMachineReadable()).toBe(true);
      Renderer.setFormat('json');
      expect(Renderer.isMachineReadable()).toBe(true);
      Renderer.setFormat('table');
      expect(Renderer.isMachineReadable()).toBe(false);
    });
  });

  describe('printTable', () => {
    it('emits TSV with header in plain mode', () => {
      Renderer.setFormat('plain');
      Renderer.printTable(['a', 'b'], [['1', '2']]);
      expect(captured()).toBe('a\tb\n1\t2\n');
    });

    it('emits a JSON array of objects in json mode', () => {
      Renderer.setFormat('json');
      Renderer.printTable(['a', 'b'], [['1', '2']]);
      const out = captured();
      expect(JSON.parse(out.trim())).toEqual([{ a: '1', b: '2' }]);
    });

    it('emits a pretty box-drawn table in table mode', () => {
      Renderer.setFormat('table');
      Renderer.printTable(['a', 'b'], [['1', '2']]);
      const out = captured();
      // cli-table3 uses Unicode box-drawing characters
      expect(out).toMatch(/[┌└│]/);
    });

    it('strips ANSI from json output values', () => {
      Renderer.setFormat('json');
      Renderer.printTable(['col'], [['\x1b[32m●\x1b[39m']]);
      const parsed = JSON.parse(captured().trim());
      expect(parsed).toEqual([{ col: '●' }]);
    });
  });

  describe('printPairs', () => {
    it('emits TSV pairs in plain mode', () => {
      Renderer.setFormat('plain');
      Renderer.printPairs([['name', 'foo'], ['port', 3306]]);
      expect(captured()).toBe('name\tfoo\nport\t3306\n');
    });

    it('emits a JSON object in json mode', () => {
      Renderer.setFormat('json');
      Renderer.printPairs([['name', 'foo'], ['port', 3306]]);
      expect(JSON.parse(captured().trim())).toEqual({ name: 'foo', port: 3306 });
    });
  });

  describe('printRows', () => {
    it('forwards to printTable in plain mode', () => {
      Renderer.setFormat('plain');
      Renderer.printRows([{ id: 1, name: 'A' }, { id: 2, name: 'B' }]);
      expect(captured()).toBe('id\tname\n1\tA\n2\tB\n');
    });

    it('emits raw records preserving types in json mode', () => {
      Renderer.setFormat('json');
      Renderer.printRows([{ id: 1, active: true }]);
      expect(JSON.parse(captured().trim())).toEqual([{ id: 1, active: true }]);
    });

    it('emits [] in json mode for an empty result', () => {
      Renderer.setFormat('json');
      Renderer.printRows([]);
      expect(captured()).toBe('[]\n');
    });

    it('emits nothing in plain mode for an empty result', () => {
      Renderer.setFormat('plain');
      Renderer.printRows([]);
      expect(captured()).toBe('');
    });
  });

  describe('printJson', () => {
    it('writes any value as pretty JSON', () => {
      Renderer.printJson({ a: 1, b: [2, 3] });
      const out = captured().trim();
      expect(JSON.parse(out)).toEqual({ a: 1, b: [2, 3] });
      expect(out).toContain('\n  '); // pretty-printed (2-space indent)
    });
  });

  describe('section / blank', () => {
    it('section is a no-op in json mode', () => {
      Renderer.setFormat('json');
      Renderer.section('Title');
      Renderer.blank();
      expect(captured()).toBe('');
    });

    it('section emits the title in plain mode', () => {
      Renderer.setFormat('plain');
      Renderer.section('# Columns');
      expect(captured()).toBe('# Columns\n');
    });
  });
});

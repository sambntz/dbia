import { describe, it, expect } from 'vitest';
import { OutputFormatter } from '../shared/formatters/OutputFormatter.js';

describe('OutputFormatter', () => {
  describe('toJson', () => {
    it('should format an array of objects correctly', () => {
      const data = [{ a: 1, b: 'foo' }, { a: 2, b: 'bar' }];
      const result = OutputFormatter.toJson(data);
      expect(JSON.parse(result)).toEqual(data);
    });

    it('should return [] for empty data', () => {
      expect(OutputFormatter.toJson([])).toBe('[]');
    });
  });

  describe('toCsv', () => {
    it('should generate CSV with headers', () => {
      const data = [{ a: 1, b: 'foo' }];
      const result = OutputFormatter.toCsv(data);
      expect(result).toBe('a,b\n1,foo');
    });

    it('should escape commas inside values', () => {
      const data = [{ a: 'hello, world' }];
      const result = OutputFormatter.toCsv(data);
      expect(result).toBe('a\n"hello, world"');
    });

    it('should escape double quotes by doubling them', () => {
      const data = [{ a: 'he said "hello"' }];
      const result = OutputFormatter.toCsv(data);
      expect(result).toBe('a\n"he said ""hello"""');
    });

    it('should handle null and undefined as empty strings', () => {
      const data = [{ a: null, b: undefined, c: 'x' }];
      const result = OutputFormatter.toCsv(data);
      expect(result).toBe('a,b,c\n,,x');
    });

    it('should generate multiple rows', () => {
      const data = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ];
      const result = OutputFormatter.toCsv(data);
      expect(result).toBe('id,name\n1,A\n2,B');
    });

    it('should return an empty string for empty data', () => {
      expect(OutputFormatter.toCsv([])).toBe('');
    });
  });
});

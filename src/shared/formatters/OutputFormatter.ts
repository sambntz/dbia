export class OutputFormatter {
  static toJson(data: any[]): string {
    if (!data || data.length === 0) {
      return '[]';
    }
    return JSON.stringify(data, null, 2);
  }

  static toCsv(data: any[]): string {
    if (!data || data.length === 0) {
      return '';
    }

    const escapeValue = (value: any): string => {
      if (value === null || value === undefined) {
        return '';
      }
      const str = String(value);
      // Escape double quotes and wrap in quotes if it contains special characters
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const keys = Object.keys(data[0]);
    const header = keys.join(',');
    const rows = data.map((row) => keys.map((k) => escapeValue(row[k])).join(','));
    return [header, ...rows].join('\n');
  }
}

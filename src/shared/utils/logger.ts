import pc from 'picocolors';

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;
const stripAnsi = (s: string): string => s.replace(ANSI_REGEX, '');

/**
 * `machineReadable` swaps the logger's destination so that data on
 * stdout stays clean (parseable as JSON/TSV). When true:
 *   - info / success / warn  → stderr, no ANSI, no icons
 *   - error                  → stderr (already was), no ANSI, no icons
 * When false (default, used by the legacy `table` format):
 *   - info / success / warn  → stdout with the cute icons + colors
 *   - error                  → stderr with the icon + color
 */
export class Logger {
  private static machineReadable = false;

  static setMachineReadable(value: boolean): void {
    Logger.machineReadable = value;
  }

  static info(message: string): void {
    if (Logger.machineReadable) {
      process.stderr.write(stripAnsi(message) + '\n');
      return;
    }
    console.log(pc.blue('ℹ') + '  ' + message);
  }

  static success(message: string): void {
    if (Logger.machineReadable) {
      process.stderr.write(stripAnsi(message) + '\n');
      return;
    }
    console.log(pc.green('✔') + '  ' + message);
  }

  static warn(message: string): void {
    if (Logger.machineReadable) {
      process.stderr.write(stripAnsi(message) + '\n');
      return;
    }
    console.log(pc.yellow('⚠') + '  ' + message);
  }

  static error(message: string): void {
    if (Logger.machineReadable) {
      process.stderr.write(stripAnsi(message) + '\n');
      return;
    }
    console.error(pc.red('✖') + '  ' + message);
  }

  static log(message: string): void {
    if (Logger.machineReadable) {
      process.stdout.write(stripAnsi(message) + '\n');
      return;
    }
    console.log(message);
  }
}

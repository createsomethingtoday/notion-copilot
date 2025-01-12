import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { LogEntry } from './logger';

export interface FileLoggerOptions {
  path: string;
  maxSize?: number;
  maxFiles?: number;
}

export class FileLogger {
  private baseFilename: string;
  private extension: string;
  private currentSize: number;

  constructor(private options: FileLoggerOptions) {
    const parsedPath = path.parse(options.path);
    this.baseFilename = path.join(parsedPath.dir || '.', parsedPath.name);
    this.extension = parsedPath.ext || '.log';
    this.currentSize = 0;
  }

  /**
   * Initialize the logger
   */
  async initialize(): Promise<void> {
    const dir = path.dirname(this.options.path);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
      if ((error as { code?: string }).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Write log entries to file
   */
  async write(entries: LogEntry[]): Promise<void> {
    if (entries.length === 0) return;

    // Check if rotation needed
    await this.checkRotation();

    // Format entries
    const content = `${entries
      .map(entry => this.formatEntry(entry))
      .join('\n')}\n`;

    // Write to file
    await fs.writeFile(
      this.options.path,
      content,
      { flag: 'a' }
    );

    // Update size
    this.currentSize += Buffer.byteLength(content);
  }

  /**
   * Format a log entry
   */
  private formatEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.padEnd(7);
    let message = `${timestamp} [${level}] ${entry.message}`;

    if (entry.error) {
      message += `\nError: ${entry.error.message}`;
      if (entry.error.stack) {
        message += `\n${entry.error.stack}`;
      }
    }

    if (entry.context) {
      message += `\nContext: ${JSON.stringify(entry.context, null, 2)}`;
    }

    return message;
  }

  /**
   * Check if log rotation is needed
   */
  private async checkRotation(): Promise<void> {
    try {
      const stats = await fs.stat(this.options.path);
      this.currentSize = stats.size;

      if (this.currentSize >= (this.options.maxSize ?? 10 * 1024 * 1024)) {
        await this.rotate();
      }
    } catch (error) {
      // File doesn't exist yet
      if ((error as { code?: string }).code === 'ENOENT') {
        this.currentSize = 0;
      } else {
        throw error;
      }
    }
  }

  /**
   * Rotate log files
   */
  private async rotate(): Promise<void> {
    const maxFiles = this.options.maxFiles ?? 5;

    try {
      // Get existing log files
      const dir = path.dirname(this.options.path);
      const files = await fs.readdir(dir);
      const logFiles = files
        .filter(f => f.startsWith(path.basename(this.baseFilename)))
        .sort()
        .reverse();

      // Remove oldest files if needed
      while (logFiles.length >= maxFiles) {
        const oldFile = logFiles.pop();
        if (oldFile) {
          await fs.unlink(path.join(dir, oldFile));
        }
      }

      // Rename current file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFile = `${this.baseFilename}.${timestamp}${this.extension}`;
      await fs.rename(this.options.path, rotatedFile);

      // Reset size
      this.currentSize = 0;
    } catch (error) {
      // Handle rotation errors
      console.error('Error rotating log files:', error);
      throw error;
    }
  }
} 
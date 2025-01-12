import fs from 'node:fs/promises';
import path from 'node:path';
import type { LogEntry } from './logger';

interface FileLoggerOptions {
  path: string;
  maxSize: number;
  maxFiles: number;
}

export class FileLogger {
  private currentSize: number;
  private currentFileIndex: number;
  private readonly baseFilename: string;
  private readonly extension: string;

  constructor(private options: FileLoggerOptions) {
    const { dir, name, ext } = path.parse(options.path);
    this.baseFilename = path.join(dir, name);
    this.extension = ext || '.log';
    this.currentSize = 0;
    this.currentFileIndex = 0;
  }

  /**
   * Initialize the logger
   */
  async initialize(): Promise<void> {
    // Create log directory if it doesn't exist
    const dir = path.dirname(this.options.path);
    await fs.mkdir(dir, { recursive: true });

    // Find current file index and size
    await this.findCurrentFile();
  }

  /**
   * Write log entries to file
   */
  async write(entries: LogEntry[]): Promise<void> {
    if (entries.length === 0) return;

    const data = `${entries
      .map(entry => this.formatLogEntry(entry))
      .join('\n')}\n`;

    const size = Buffer.byteLength(data);

    // Check if we need to rotate
    if (this.currentSize + size > this.options.maxSize) {
      await this.rotate();
    }

    // Write to current file
    await fs.appendFile(this.getCurrentFilePath(), data);
    this.currentSize += size;
  }

  /**
   * Format a log entry for file writing
   */
  private formatLogEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(7);
    const message = entry.message;
    
    let result = `${timestamp} [${level}] ${message}`;

    if (entry.error) {
      result += `\nError: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        result += `\nStack: ${entry.error.stack}`;
      }
    }

    if (entry.context) {
      result += `\nContext: ${JSON.stringify(entry.context, null, 2)}`;
    }

    return result;
  }

  /**
   * Get the path for the current log file
   */
  private getCurrentFilePath(): string {
    if (this.currentFileIndex === 0) {
      return this.options.path;
    }
    return `${this.baseFilename}.${this.currentFileIndex}${this.extension}`;
  }

  /**
   * Find the current log file and its size
   */
  private async findCurrentFile(): Promise<void> {
    try {
      const stats = await fs.stat(this.options.path);
      this.currentSize = stats.size;
    } catch (error) {
      // File doesn't exist yet
      this.currentSize = 0;
    }

    // Find existing rotated files
    const dir = path.dirname(this.options.path);
    const files = await fs.readdir(dir);
    
    const pattern = new RegExp(
      `^${path.basename(this.baseFilename)}\\.\\d+${this.extension}$`
    );

    const indices = files
      .filter(f => pattern.test(f))
      .map(f => {
        const match = f.match(/\.(\d+)\./);
        return match ? Number.parseInt(match[1], 10) : 0;
      })
      .filter(i => !Number.isNaN(i));

    this.currentFileIndex = indices.length > 0 ? Math.max(...indices) : 0;
  }

  /**
   * Rotate log files
   */
  private async rotate(): Promise<void> {
    // Delete oldest file if we've reached max files
    if (this.currentFileIndex >= this.options.maxFiles - 1) {
      const oldestFile = `${this.baseFilename}.${
        this.currentFileIndex - this.options.maxFiles + 2
      }${this.extension}`;
      
      try {
        await fs.unlink(oldestFile);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }

    // Rotate existing files
    for (let i = this.currentFileIndex; i >= 0; i--) {
      const oldPath = i === 0 ? this.options.path : `${this.baseFilename}.${i}${this.extension}`;
      const newPath = `${this.baseFilename}.${i + 1}${this.extension}`;

      try {
        await fs.rename(oldPath, newPath);
      } catch (error) {
        // Ignore if file doesn't exist
      }
    }

    // Update state
    this.currentFileIndex++;
    this.currentSize = 0;
  }
} 
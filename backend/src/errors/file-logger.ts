import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { LogEntry } from './logger';

export interface FileLoggerOptions {
  path?: string;
  maxSize?: number;
  maxFiles?: number;
}

export class FileLogger {
  private logDir: string;
  private logName: string;
  private logExt: string;
  private maxSize: number;
  private maxFiles: number;
  private currentPath: string;

  constructor(options?: FileLoggerOptions) {
    const defaultPath = './logs/app.log';
    const parsedPath = path.parse(options?.path || defaultPath);
    this.logDir = parsedPath.dir === '' ? '.' : parsedPath.dir;
    this.logName = parsedPath.name || 'app';
    this.logExt = parsedPath.ext || '.log';
    this.maxSize = options?.maxSize || 10 * 1024 * 1024; // 10MB default
    this.maxFiles = options?.maxFiles || 5;
    this.currentPath = this.getLogPath();
  }

  private getLogPath(index = 0): string {
    return path.join(this.logDir, `${this.logName}${index ? `.${index}` : ''}${this.logExt}`);
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async write(entries: LogEntry[]): Promise<void> {
    if (!entries.length) return;

    await this.initialize();
    await this.checkRotation();

    const content = `${entries.map(entry => this.formatEntry(entry)).join('\n')}\n`;
    
    try {
      await fs.appendFile(this.currentPath, content, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
      throw error;
    }
  }

  private formatEntry(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.padEnd(7);
    const message = entry.message;
    const context = entry.context ? JSON.stringify(entry.context) : '';
    const error = entry.error ? `\n${entry.error.stack || entry.error.message}` : '';
    
    return `${timestamp} [${level}] ${message}${context ? ` ${context}` : ''}${error}`;
  }

  private async checkRotation(): Promise<void> {
    try {
      const stats = await fs.stat(this.currentPath);
      if (stats.size < this.maxSize) return;

      // Rotate files
      for (let i = this.maxFiles - 1; i >= 0; i--) {
        const oldPath = this.getLogPath(i);
        const newPath = this.getLogPath(i + 1);

        try {
          await fs.access(oldPath);
          if (i === this.maxFiles - 1) {
            await fs.unlink(oldPath);
          } else {
            await fs.rename(oldPath, newPath);
          }
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
          }
        }
      }

      // Reset current path to base log file
      this.currentPath = this.getLogPath();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
} 
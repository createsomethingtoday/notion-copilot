import type { NotionAssistantError } from './types';
import { ErrorSeverity } from './types';
import { FileLogger } from './file-logger';

export interface LogEntry {
  timestamp: Date;
  level: ErrorSeverity;
  message: string;
  error?: NotionAssistantError;
  context?: Record<string, unknown>;
}

interface LoggerOptions {
  minLevel?: ErrorSeverity;
  console?: boolean;
  file?: {
    path: string;
    maxSize?: number;
    maxFiles?: number;
  };
  monitoring?: {
    enabled: boolean;
    endpoint?: string;
    apiKey?: string;
  };
}

export class Logger {
  private options: Required<LoggerOptions>;
  private logBuffer: LogEntry[] = [];
  private flushInterval?: NodeJS.Timeout;
  private fileLogger?: FileLogger;

  constructor(options: LoggerOptions = {}) {
    this.options = {
      minLevel: options.minLevel ?? ErrorSeverity.INFO,
      console: options.console ?? true,
      file: {
        path: options.file?.path ?? './logs/notion-assistant.log',
        maxSize: options.file?.maxSize ?? 10 * 1024 * 1024, // 10MB
        maxFiles: options.file?.maxFiles ?? 5
      },
      monitoring: {
        enabled: options.monitoring?.enabled ?? false,
        endpoint: options.monitoring?.endpoint,
        apiKey: options.monitoring?.apiKey
      }
    };

    void this.initialize();
  }

  /**
   * Initialize the logger
   */
  private async initialize(): Promise<void> {
    // Initialize file logger if path is provided
    if (this.options.file.path) {
      this.fileLogger = new FileLogger({
        path: this.options.file.path,
        maxSize: this.options.file.maxSize ?? 10 * 1024 * 1024,
        maxFiles: this.options.file.maxFiles ?? 5
      });
      await this.fileLogger.initialize();
    }

    this.setupFlushInterval();
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(ErrorSeverity.DEBUG, message, undefined, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(ErrorSeverity.INFO, message, undefined, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(ErrorSeverity.WARNING, message, error, context);
  }

  /**
   * Log an error message
   */
  error(message: string, error: Error, context?: Record<string, unknown>): void {
    this.log(ErrorSeverity.ERROR, message, error, context);
  }

  /**
   * Log a critical error message
   */
  critical(message: string, error: Error, context?: Record<string, unknown>): void {
    this.log(ErrorSeverity.CRITICAL, message, error, context);
  }

  /**
   * Core logging function
   */
  private log(
    level: ErrorSeverity,
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ): void {
    // Check minimum log level
    if (this.getSeverityLevel(level) < this.getSeverityLevel(this.options.minLevel)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context
    };

    if (error) {
      if (error instanceof Error) {
        entry.error = error as NotionAssistantError;
      }
      entry.context = {
        ...entry.context,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      };
    }

    // Add to buffer
    this.logBuffer.push(entry);

    // Console logging if enabled
    if (this.options.console) {
      this.logToConsole(entry);
    }

    // Immediate flush for high severity
    if (
      level === ErrorSeverity.ERROR || 
      level === ErrorSeverity.CRITICAL
    ) {
      void this.flush();
    }
  }

  /**
   * Console logging formatter
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(7);
    const message = `${timestamp} [${level}] ${entry.message}`;

    switch (entry.level) {
      case ErrorSeverity.DEBUG:
        console.log(message, entry.context);
        break;
      case ErrorSeverity.INFO:
        console.info(message, entry.context);
        break;
      case ErrorSeverity.WARNING:
        console.warn(message, entry.context);
        break;
      case ErrorSeverity.ERROR:
      case ErrorSeverity.CRITICAL:
        console.error(message, entry.context);
        if (entry.error?.stack) {
          console.error(entry.error.stack);
        }
        break;
    }
  }

  /**
   * Flush logs to persistent storage and monitoring
   */
  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    try {
      // File logging
      if (this.fileLogger) {
        await this.fileLogger.write(entries);
      }

      // Monitoring
      if (this.options.monitoring.enabled) {
        await this.flushToMonitoring(entries);
      }
    } catch (error) {
      // If flush fails, add back to buffer
      this.logBuffer = [...entries, ...this.logBuffer];
      console.error('Failed to flush logs:', error);
    }
  }

  /**
   * Flush logs to monitoring service
   */
  private async flushToMonitoring(entries: LogEntry[]): Promise<void> {
    if (!this.options.monitoring.endpoint) return;

    // Implementation would go here
    // Would handle batching, retry logic, etc.
  }

  /**
   * Set up periodic flush interval
   */
  private setupFlushInterval(): void {
    this.flushInterval = setInterval(() => {
      void this.flush();
    }, 5000); // Flush every 5 seconds
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }

  /**
   * Convert severity level to numeric value for comparison
   */
  private getSeverityLevel(severity: ErrorSeverity): number {
    const levels: Record<ErrorSeverity, number> = {
      [ErrorSeverity.DEBUG]: 0,
      [ErrorSeverity.INFO]: 1,
      [ErrorSeverity.WARNING]: 2,
      [ErrorSeverity.ERROR]: 3,
      [ErrorSeverity.CRITICAL]: 4
    };
    return levels[severity];
  }
} 
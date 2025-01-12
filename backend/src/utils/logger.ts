export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export class Logger {
  private readonly namespace: string;

  constructor(namespace: string) {
    this.namespace = namespace;
  }

  debug(message: string, context: LogContext = {}): void {
    this.log('debug', message, context);
  }

  info(message: string, context: LogContext = {}): void {
    this.log('info', message, context);
  }

  warn(message: string, context: LogContext = {}): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context: LogContext = {}): void {
    this.log('error', message, {
      ...context,
      error: error?.message,
      stack: error?.stack
    });
  }

  private log(level: LogLevel, message: string, context: LogContext): void {
    const timestamp = new Date().toISOString();
    console.log(JSON.stringify({
      timestamp,
      level,
      namespace: this.namespace,
      message,
      ...context
    }));
  }
} 
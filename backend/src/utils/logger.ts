export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export class Logger {
  private readonly context: string;

  constructor(context: string) {
    this.context = context;
  }

  private log(level: LogLevel, message: string, error?: Error, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message,
      ...(error && { error: { message: error.message, stack: error.stack } }),
      ...(context && { data: context })
    };
    
    console.log(JSON.stringify(logEntry));
  }

  debug(message: string, context?: LogContext): void {
    this.log('debug', message, undefined, context);
  }

  info(message: string, context?: LogContext): void {
    this.log('info', message, undefined, context);
  }

  warn(message: string, error?: Error, context?: LogContext): void {
    this.log('warn', message, error, context);
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.log('error', message, error, context);
  }
} 
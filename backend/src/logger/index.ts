export interface LogContext {
  [key: string]: unknown;
}

export interface LogMessage {
  message: string;
  context?: LogContext;
}

export interface Logger {
  debug(message: LogMessage | string): void;
  info(message: LogMessage | string): void;
  warn(message: LogMessage | string): void;
  error(message: LogMessage | string): void;
}

class ConsoleLogger implements Logger {
  constructor(private readonly namespace: string) {}

  private formatMessage(level: string, message: LogMessage | string): string {
    const timestamp = new Date().toISOString();
    const logMessage = typeof message === 'string' ? { message } : message;
    const context = logMessage.context ? ` ${JSON.stringify(logMessage.context)}` : '';
    return `${timestamp} [${level}] [${this.namespace}] ${logMessage.message}${context}`;
  }

  debug(message: LogMessage | string): void {
    console.debug(this.formatMessage('DEBUG', message));
  }

  info(message: LogMessage | string): void {
    console.info(this.formatMessage('INFO', message));
  }

  warn(message: LogMessage | string): void {
    console.warn(this.formatMessage('WARN', message));
  }

  error(message: LogMessage | string): void {
    console.error(this.formatMessage('ERROR', message));
  }
}

export function getLogger(namespace: string): Logger {
  return new ConsoleLogger(namespace);
} 
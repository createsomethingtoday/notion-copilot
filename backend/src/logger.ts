import type { NotionAssistantError } from './errors/types';

export interface LogContext {
  [key: string]: string | number | boolean | null | undefined;
}

export interface LogMessage {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: LogContext;
  error?: Error | NotionAssistantError;
  timestamp: Date;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, error?: Error | NotionAssistantError, context?: LogContext): void;
}

class ConsoleLogger implements Logger {
  private namespace: string;

  constructor(namespace: string) {
    this.namespace = namespace;
  }

  private formatMessage(level: LogMessage['level'], message: string, context?: LogContext, error?: Error | NotionAssistantError): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    const errorStr = error ? `\n${error.stack || error.message}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${this.namespace}] ${message}${contextStr}${errorStr}`;
  }

  debug(message: string, context?: LogContext): void {
    console.debug(this.formatMessage('debug', message, context));
  }

  info(message: string, context?: LogContext): void {
    console.info(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, error?: Error | NotionAssistantError, context?: LogContext): void {
    console.error(this.formatMessage('error', message, context, error));
  }
}

export function getLogger(namespace: string): Logger {
  return new ConsoleLogger(namespace);
} 
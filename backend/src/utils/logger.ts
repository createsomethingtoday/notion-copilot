export interface LogMetadata {
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string, metadata?: LogMetadata): void;
}

export class ConsoleLogger implements Logger {
  private readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  debug(message: string, metadata?: LogMetadata): void {
    console.debug(`[${this.name}] ${message}`, metadata || '');
  }

  info(message: string, metadata?: LogMetadata): void {
    console.info(`[${this.name}] ${message}`, metadata || '');
  }

  warn(message: string, metadata?: LogMetadata): void {
    console.warn(`[${this.name}] ${message}`, metadata || '');
  }

  error(message: string, metadata?: LogMetadata): void {
    console.error(`[${this.name}] ${message}`, metadata || '');
  }
} 
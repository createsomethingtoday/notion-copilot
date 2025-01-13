import Redis from 'ioredis';
import { CircuitBreaker } from './circuit-breaker';
import { Logger } from './logger';
import { NotionAssistantError, ErrorCode, ErrorSeverity } from '../errors/types';

export interface RedisClientOptions {
  host: string;
  port: number;
  password: string | null;
  maxRetries?: number;
  retryDelayMs?: number;
  monitorIntervalMs?: number;
}

export class RedisClient {
  private client: Redis;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly logger: Logger;
  private reconnectTimer?: NodeJS.Timeout;
  private readonly options: Required<Omit<RedisClientOptions, 'password'>> & { password: string | null };

  constructor(options: RedisClientOptions) {
    this.options = {
      maxRetries: 3,
      retryDelayMs: 1000,
      monitorIntervalMs: 30000,
      ...options
    };

    this.logger = new Logger('RedisClient');
    this.client = this.createClient();
    
    this.circuitBreaker = new CircuitBreaker('redis', {
      maxFailures: 3,
      resetTimeoutMs: 60000,
      halfOpenMaxAttempts: 2,
      monitorIntervalMs: this.options.monitorIntervalMs
    }, this.logger);

    this.setupEventHandlers();
  }

  private createClient(): Redis {
    return new Redis({
      host: this.options.host,
      port: this.options.port,
      password: this.options.password,
      retryStrategy: (times: number) => {
        if (times > this.options.maxRetries) {
          return null; // Stop retrying
        }
        return this.options.retryDelayMs * (2 ** (times - 1));
      },
      maxRetriesPerRequest: 3
    });
  }

  private setupEventHandlers(): void {
    this.client.on('error', (error: Error) => {
      this.logger.error('Redis client error', { errorMessage: error.message });
      this.handleConnectionError(error);
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
      this.scheduleReconnect();
    });

    this.client.on('reconnecting', (delay: number) => {
      this.logger.info('Attempting to reconnect to Redis', { delay });
    });

    this.client.on('connect', () => {
      this.logger.info('Redis connected successfully');
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
      }
    });
  }

  private handleConnectionError(error: Error): void {
    const notionError = new NotionAssistantError(
      'Redis connection error',
      ErrorCode.CONNECTION_RESET,
      ErrorSeverity.ERROR,
      true,
      { originalError: error.message }
    );

    this.circuitBreaker.execute(async () => {
      throw notionError;
    }).catch(() => {
      // Circuit breaker will handle the error
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.logger.info('Attempting to reconnect to Redis');
      this.client.disconnect();
      this.client = this.createClient();
      this.setupEventHandlers();
    }, this.options.retryDelayMs);
  }

  public async execute<T>(command: string, args: unknown[] = []): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      try {
        return await this.client.send_command(command, args);
      } catch (error) {
        throw this.normalizeError(error);
      }
    });
  }

  private normalizeError(error: unknown): NotionAssistantError {
    if (error instanceof NotionAssistantError) {
      return error;
    }

    const err = error as Error;
    if (err.message?.includes('ECONNREFUSED')) {
      return new NotionAssistantError(
        'Redis connection refused',
        ErrorCode.CONNECTION_RESET,
        ErrorSeverity.ERROR,
        true,
        { errorMessage: err.message }
      );
    }
    if (err.message?.includes('ETIMEDOUT')) {
      return new NotionAssistantError(
        'Redis connection timed out',
        ErrorCode.TIMEOUT,
        ErrorSeverity.ERROR,
        true,
        { errorMessage: err.message }
      );
    }

    return new NotionAssistantError(
      'Redis operation failed',
      ErrorCode.INTERNAL_ERROR,
      ErrorSeverity.ERROR,
      true,
      { errorMessage: err.message }
    );
  }

  public async ping(): Promise<boolean> {
    try {
      const result = await this.execute<string>('ping');
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  public destroy(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.client.disconnect();
    this.circuitBreaker.destroy();
  }
} 
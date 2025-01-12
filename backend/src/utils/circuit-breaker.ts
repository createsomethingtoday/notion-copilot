import type { Logger } from '@/logger';

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  maxFailures: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts?: number;
  monitorIntervalMs?: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private failures = 0;
  private lastFailureTime?: number;
  private resetTimeout?: NodeJS.Timeout;
  private readonly maxFailures: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenMaxAttempts: number;
  private readonly monitorIntervalMs: number;

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions,
    private readonly logger: Logger
  ) {
    this.maxFailures = options.maxFailures;
    this.resetTimeoutMs = options.resetTimeoutMs;
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts ?? 1;
    this.monitorIntervalMs = options.monitorIntervalMs ?? 30000;
  }

  private setState(newState: CircuitBreakerState): void {
    if (this.state !== newState) {
      this.logger.info(`Circuit breaker ${this.name} state changed from ${this.state} to ${newState}`);
      this.state = newState;
    }
  }

  private scheduleReset(): void {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }
    this.resetTimeout = setTimeout(() => {
      this.setState('half-open');
    }, this.resetTimeoutMs);
  }

  async execute<T>(action: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      throw new Error(`Circuit breaker ${this.name} is open`);
    }

    try {
      const result = await action();
      if (this.state === 'half-open') {
        this.setState('closed');
        this.failures = 0;
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.maxFailures) {
        this.setState('open');
        this.scheduleReset();
      }

      throw error;
    }
  }

  destroy(): void {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
    }
  }
} 
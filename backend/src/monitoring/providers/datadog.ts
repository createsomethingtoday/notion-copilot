import type { MetricProvider, MetricValue } from '@/monitoring/types';
import type { Logger } from '@/logger';
import { getLogger } from '@/logger';
import { NotionAssistantError } from '@/errors/types';
import { ErrorCode, ErrorSeverity } from '@/errors/types';
import { CircuitBreaker } from '@/utils/circuit-breaker';

export class DatadogProvider implements MetricProvider {
  private readonly logger: Logger;
  private readonly apiKey: string;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(apiKey: string) {
    this.logger = getLogger('DatadogProvider');
    this.apiKey = apiKey;
    this.circuitBreaker = new CircuitBreaker('datadog', {
      maxFailures: 3,
      resetTimeoutMs: 60000,
      halfOpenMaxAttempts: 2,
      monitorIntervalMs: 30000
    }, this.logger);
  }

  private normalizeError(error: unknown): NotionAssistantError {
    if (error instanceof NotionAssistantError) {
      return error;
    }

    const err = error as Error;
    if (err.message?.includes('401')) {
      return new NotionAssistantError(
        'Invalid Datadog API key',
        ErrorCode.UNAUTHORIZED,
        ErrorSeverity.ERROR,
        true,
        { error: err }
      );
    }
    if (err.message?.includes('429')) {
      return new NotionAssistantError(
        'Datadog rate limit exceeded',
        ErrorCode.RATE_LIMIT_EXCEEDED,
        ErrorSeverity.ERROR,
        true,
        { error: err }
      );
    }
    if (err.message?.includes('5')) {
      return new NotionAssistantError(
        'Datadog service unavailable',
        ErrorCode.SERVICE_UNAVAILABLE,
        ErrorSeverity.ERROR,
        true,
        { error: err }
      );
    }
    
    return new NotionAssistantError(
      'Failed to send metrics to Datadog',
      ErrorCode.INTERNAL_ERROR,
      ErrorSeverity.ERROR,
      true,
      { error: err }
    );
  }

  async sendMetrics(metrics: MetricValue[]): Promise<void> {
    try {
      await this.circuitBreaker.execute(async () => {
        // Implementation of sending metrics to Datadog
        this.logger.debug('Sending metrics to Datadog', { count: metrics.length });
        
        // Mock implementation for now
        await new Promise(resolve => setTimeout(resolve, 100));
        
        this.logger.info('Successfully sent metrics to Datadog', { count: metrics.length });
      });
    } catch (error) {
      const normalizedError = this.normalizeError(error);
      this.logger.error('Failed to send metrics to Datadog', normalizedError, {
        count: metrics.length,
        errorCode: normalizedError.code
      });
      throw normalizedError;
    }
  }
} 
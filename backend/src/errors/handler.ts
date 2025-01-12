import type { ErrorRecoveryStrategy } from './types';
import { 
  NotionAssistantError,
  ErrorCode, 
  ErrorSeverity,
  DEFAULT_RECOVERY_STRATEGIES
} from './types';

interface ErrorHandlerOptions {
  maxRetries?: number;
  defaultBackoffMs?: number;
  onError?: (error: NotionAssistantError) => Promise<void>;
  onRetry?: (error: NotionAssistantError, attempt: number) => Promise<void>;
  onCleanup?: (error: NotionAssistantError) => Promise<void>;
}

export class ErrorHandler {
  private options: Required<ErrorHandlerOptions>;

  constructor(options: ErrorHandlerOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      defaultBackoffMs: options.defaultBackoffMs ?? 1000,
      onError: options.onError ?? (async () => {}),
      onRetry: options.onRetry ?? (async () => {}),
      onCleanup: options.onCleanup ?? (async () => {})
    };
  }

  /**
   * Handles an error with appropriate recovery strategy
   */
  async handleError(
    error: Error,
    context?: Record<string, unknown>
  ): Promise<never> {
    // Convert to NotionAssistantError if needed
    const notionError = this.normalizeError(error, context);

    // Log/report error
    await this.options.onError(notionError);

    // Get recovery strategy
    const strategy = this.getRecoveryStrategy(notionError.code);

    // Execute recovery strategy
    if (strategy.cleanup) {
      await this.executeCleanup(notionError, strategy);
    }

    if (strategy.retryable) {
      await this.executeRetry(notionError, strategy);
    }

    // Always throw the error after handling
    throw notionError;
  }

  /**
   * Normalizes any error into a NotionAssistantError
   */
  private normalizeError(
    error: Error,
    context?: Record<string, unknown>
  ): NotionAssistantError {
    if (error instanceof NotionAssistantError) {
      return error;
    }

    // Handle known error types
    if (error.name === 'NotionClientError') {
      return new NotionAssistantError(
        error.message,
        ErrorCode.NOTION_API_ERROR,
        ErrorSeverity.ERROR,
        true,
        context
      );
    }

    if (error.name === 'OpenAIError') {
      return new NotionAssistantError(
        error.message,
        ErrorCode.OPENAI_API_ERROR,
        ErrorSeverity.ERROR,
        true,
        context
      );
    }

    // Default to internal error
    return new NotionAssistantError(
      error.message,
      ErrorCode.INTERNAL_ERROR,
      ErrorSeverity.ERROR,
      false,
      context
    );
  }

  /**
   * Gets the recovery strategy for an error code
   */
  private getRecoveryStrategy(code: ErrorCode): ErrorRecoveryStrategy {
    return {
      ...DEFAULT_RECOVERY_STRATEGIES[code],
      maxRetries: Math.min(
        DEFAULT_RECOVERY_STRATEGIES[code].maxRetries ?? this.options.maxRetries,
        this.options.maxRetries
      ),
      backoffMs: DEFAULT_RECOVERY_STRATEGIES[code].backoffMs ?? this.options.defaultBackoffMs
    };
  }

  /**
   * Executes cleanup for an error
   */
  private async executeCleanup(
    error: NotionAssistantError,
    strategy: ErrorRecoveryStrategy
  ): Promise<void> {
    try {
      await strategy.cleanup?.();
      await this.options.onCleanup(error);
    } catch (cleanupError) {
      // Log cleanup error but don't throw
      console.error('Error during cleanup:', cleanupError);
    }
  }

  /**
   * Executes retry strategy for an error
   */
  private async executeRetry(
    error: NotionAssistantError,
    strategy: ErrorRecoveryStrategy
  ): Promise<void> {
    const maxRetries = strategy.maxRetries ?? this.options.maxRetries;
    const backoffMs = strategy.backoffMs ?? this.options.defaultBackoffMs;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.options.onRetry(error, attempt);
        
        // Wait with exponential backoff
        const delay = backoffMs * (2 ** (attempt - 1));
        await new Promise(resolve => setTimeout(resolve, delay));

        // Remove return statement to ensure error is thrown
      } catch (retryError) {
        if (attempt === maxRetries) {
          throw this.normalizeError(retryError as Error, {
            originalError: error,
            attempt
          });
        }
      }
    }
  }

  /**
   * Creates a wrapped version of a function with error handling
   */
  wrap<TArgs extends unknown[], TReturn>(
    fn: (...args: TArgs) => Promise<TReturn>,
    context?: Record<string, unknown>
  ): (...args: TArgs) => Promise<TReturn> {
    return async (...args: TArgs): Promise<TReturn> => {
      try {
        return await fn(...args);
      } catch (error) {
        // Always throw the normalized error
        throw await this.handleError(error as Error, {
          ...context,
          arguments: args
        });
      }
    };
  }
} 
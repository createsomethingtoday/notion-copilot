/**
 * Base error class for all application errors
 */
export class NotionAssistantError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly severity: ErrorSeverity,
    public readonly recoverable: boolean,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'NotionAssistantError';
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      recoverable: this.recoverable,
      context: this.context
    };
  }
}

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Error categories for better handling and reporting
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHORIZATION = 'authorization',
  RATE_LIMIT = 'rate_limit',
  NETWORK = 'network',
  NOTION_API = 'notion_api',
  NLP = 'nlp',
  TASK_EXECUTION = 'task_execution',
  SYSTEM = 'system'
}

/**
 * Specific error codes for detailed error handling
 */
export enum ErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'unauthorized',
  INVALID_INPUT = 'invalid_input',
  NOT_FOUND = 'not_found',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  INTERNAL_ERROR = 'internal_error',
  NETWORK_ERROR = 'network_error',
  VALIDATION_ERROR = 'validation_error',
  
  // Task errors
  TASK_EXECUTION_FAILED = 'task_execution_failed',
  TASK_TIMEOUT = 'task_timeout',
  TASK_CANCELLED = 'task_cancelled',
  TASK_VALIDATION_FAILED = 'task_validation_failed',
  TASK_DEPENDENCY_FAILED = 'task_dependency_failed',
  
  // API errors
  NOTION_API_ERROR = 'notion_api_error',
  BLOCK_NOT_FOUND = 'block_not_found',
  PAGE_NOT_FOUND = 'page_not_found',
  DATABASE_NOT_FOUND = 'database_not_found',
  
  // System errors
  CONFIGURATION_ERROR = 'configuration_error',
  RESOURCE_EXHAUSTED = 'resource_exhausted',
  CONCURRENT_REQUESTS_EXCEEDED = 'concurrent_requests_exceeded',
  NETWORK_UNAVAILABLE = 'network_unavailable',
  CONNECTION_RESET = 'connection_reset',
  TIMEOUT = 'timeout'
}

/**
 * Error with recovery strategies
 */
export interface ErrorRecoveryStrategy {
  retryable: boolean;
  maxRetries?: number;
  backoffMs?: number;
  requiresUserInput?: boolean;
  alternativeAction?: string;
  cleanup?: () => Promise<void>;
}

/**
 * Maps error codes to their default recovery strategies
 */
export const DEFAULT_RECOVERY_STRATEGIES: Record<ErrorCode, ErrorRecoveryStrategy> = {
  [ErrorCode.UNAUTHORIZED]: {
    retryable: true,
    maxRetries: 1,
    requiresUserInput: true,
    alternativeAction: 'Reauthenticate'
  },
  [ErrorCode.INVALID_INPUT]: {
    retryable: false,
    requiresUserInput: true
  },
  [ErrorCode.NOT_FOUND]: {
    retryable: false,
    requiresUserInput: true,
    alternativeAction: 'Verify resource exists'
  },
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    retryable: true,
    maxRetries: 3,
    backoffMs: 1000
  },
  [ErrorCode.SERVICE_UNAVAILABLE]: {
    retryable: true,
    maxRetries: 3,
    backoffMs: 5000
  },
  [ErrorCode.INTERNAL_ERROR]: {
    retryable: false,
    cleanup: async () => {/* System cleanup logic */}
  },
  [ErrorCode.NETWORK_ERROR]: {
    retryable: true,
    maxRetries: 3,
    backoffMs: 1000
  },
  [ErrorCode.VALIDATION_ERROR]: {
    retryable: false,
    requiresUserInput: true
  },
  [ErrorCode.TASK_EXECUTION_FAILED]: {
    retryable: true,
    maxRetries: 2,
    backoffMs: 1000
  },
  [ErrorCode.TASK_TIMEOUT]: {
    retryable: true,
    maxRetries: 1,
    backoffMs: 2000
  },
  [ErrorCode.TASK_CANCELLED]: {
    retryable: false,
    cleanup: async () => {/* Cleanup cancelled task */}
  },
  [ErrorCode.TASK_VALIDATION_FAILED]: {
    retryable: false,
    requiresUserInput: true
  },
  [ErrorCode.TASK_DEPENDENCY_FAILED]: {
    retryable: false,
    cleanup: async () => {/* Cleanup dependent tasks */}
  },
  [ErrorCode.NOTION_API_ERROR]: {
    retryable: true,
    maxRetries: 2,
    backoffMs: 1000
  },
  [ErrorCode.BLOCK_NOT_FOUND]: {
    retryable: false,
    requiresUserInput: true
  },
  [ErrorCode.PAGE_NOT_FOUND]: {
    retryable: false,
    requiresUserInput: true
  },
  [ErrorCode.DATABASE_NOT_FOUND]: {
    retryable: false,
    requiresUserInput: true
  },
  [ErrorCode.CONFIGURATION_ERROR]: {
    retryable: false,
    requiresUserInput: true
  },
  [ErrorCode.RESOURCE_EXHAUSTED]: {
    retryable: true,
    maxRetries: 1,
    backoffMs: 5000,
    cleanup: async () => {/* Resource cleanup logic */}
  },
  [ErrorCode.CONCURRENT_REQUESTS_EXCEEDED]: {
    retryable: true,
    maxRetries: 3,
    backoffMs: 500
  },
  [ErrorCode.NETWORK_UNAVAILABLE]: {
    retryable: true,
    maxRetries: 3,
    backoffMs: 1000
  },
  [ErrorCode.CONNECTION_RESET]: {
    retryable: true,
    maxRetries: 2,
    backoffMs: 500
  },
  [ErrorCode.TIMEOUT]: {
    retryable: true,
    maxRetries: 2,
    backoffMs: 500
  }
}; 
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
  DEBUG = 'debug',
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
  // Validation errors
  INVALID_INPUT = 'invalid_input',
  INVALID_STATE = 'invalid_state',
  MISSING_REQUIRED_FIELD = 'missing_required_field',
  INVALID_TASK_TYPE = 'invalid_task_type',

  // Authorization errors
  UNAUTHORIZED = 'unauthorized',
  INSUFFICIENT_PERMISSIONS = 'insufficient_permissions',
  INVALID_TOKEN = 'invalid_token',
  TOKEN_EXPIRED = 'token_expired',

  // Rate limit errors
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  CONCURRENT_REQUESTS_EXCEEDED = 'concurrent_requests_exceeded',

  // Network errors
  NETWORK_UNAVAILABLE = 'network_unavailable',
  TIMEOUT = 'timeout',
  CONNECTION_RESET = 'connection_reset',

  // Notion API errors
  NOTION_API_ERROR = 'notion_api_error',
  BLOCK_NOT_FOUND = 'block_not_found',
  PAGE_NOT_FOUND = 'page_not_found',
  DATABASE_NOT_FOUND = 'database_not_found',
  INVALID_NOTION_REQUEST = 'invalid_notion_request',

  // NLP errors
  NLP_PROCESSING_ERROR = 'nlp_processing_error',
  INVALID_TASK_ANALYSIS = 'invalid_task_analysis',
  CONTEXT_ERROR = 'context_error',
  OPENAI_API_ERROR = 'openai_api_error',

  // Task execution errors
  TASK_EXECUTION_FAILED = 'task_execution_failed',
  TASK_TIMEOUT = 'task_timeout',
  TASK_CANCELLED = 'task_cancelled',
  TASK_DEPENDENCY_FAILED = 'task_dependency_failed',
  TASK_VALIDATION_FAILED = 'task_validation_failed',

  // System errors
  INTERNAL_ERROR = 'internal_error',
  CONFIGURATION_ERROR = 'configuration_error',
  RESOURCE_EXHAUSTED = 'resource_exhausted'
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
  // Validation errors - generally not retryable
  [ErrorCode.INVALID_INPUT]: {
    retryable: false,
    requiresUserInput: true
  },
  [ErrorCode.INVALID_STATE]: {
    retryable: false,
    cleanup: async () => {/* Reset state logic */}
  },
  [ErrorCode.MISSING_REQUIRED_FIELD]: {
    retryable: false,
    requiresUserInput: true
  },
  [ErrorCode.INVALID_TASK_TYPE]: {
    retryable: false,
    requiresUserInput: true
  },

  // Authorization errors - may be retryable with new token
  [ErrorCode.UNAUTHORIZED]: {
    retryable: true,
    maxRetries: 1,
    requiresUserInput: true,
    alternativeAction: 'Reauthenticate'
  },
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: {
    retryable: false,
    requiresUserInput: true,
    alternativeAction: 'Request access'
  },
  [ErrorCode.INVALID_TOKEN]: {
    retryable: true,
    maxRetries: 1,
    requiresUserInput: true,
    alternativeAction: 'Reauthenticate'
  },
  [ErrorCode.TOKEN_EXPIRED]: {
    retryable: true,
    maxRetries: 1,
    alternativeAction: 'Refresh token'
  },

  // Rate limit errors - retryable with backoff
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    retryable: true,
    maxRetries: 3,
    backoffMs: 1000
  },
  [ErrorCode.CONCURRENT_REQUESTS_EXCEEDED]: {
    retryable: true,
    maxRetries: 3,
    backoffMs: 500
  },

  // Network errors - retryable with backoff
  [ErrorCode.NETWORK_UNAVAILABLE]: {
    retryable: true,
    maxRetries: 3,
    backoffMs: 1000
  },
  [ErrorCode.TIMEOUT]: {
    retryable: true,
    maxRetries: 2,
    backoffMs: 500
  },
  [ErrorCode.CONNECTION_RESET]: {
    retryable: true,
    maxRetries: 2,
    backoffMs: 500
  },

  // Notion API errors - varies by type
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
  [ErrorCode.INVALID_NOTION_REQUEST]: {
    retryable: false,
    requiresUserInput: true
  },

  // NLP errors - some retryable
  [ErrorCode.NLP_PROCESSING_ERROR]: {
    retryable: true,
    maxRetries: 2,
    backoffMs: 1000
  },
  [ErrorCode.INVALID_TASK_ANALYSIS]: {
    retryable: true,
    maxRetries: 1
  },
  [ErrorCode.CONTEXT_ERROR]: {
    retryable: false,
    cleanup: async () => {/* Context cleanup logic */}
  },
  [ErrorCode.OPENAI_API_ERROR]: {
    retryable: true,
    maxRetries: 2,
    backoffMs: 1000
  },

  // Task execution errors - varies by type
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
  [ErrorCode.TASK_DEPENDENCY_FAILED]: {
    retryable: false,
    cleanup: async () => {/* Cleanup dependent tasks */}
  },
  [ErrorCode.TASK_VALIDATION_FAILED]: {
    retryable: false,
    requiresUserInput: true
  },

  // System errors - generally not retryable
  [ErrorCode.INTERNAL_ERROR]: {
    retryable: false,
    cleanup: async () => {/* System cleanup logic */}
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
  }
}; 
import { ErrorCode } from './types';

export interface ErrorRecoveryStrategy {
  retryable: boolean;
  maxRetries?: number;
  backoffMs?: number;
  requiresUserInput?: boolean;
  cleanup?: () => Promise<void>;
}

export const ERROR_RECOVERY_STRATEGIES: Record<ErrorCode, ErrorRecoveryStrategy> = {
  [ErrorCode.INTERNAL_ERROR]: {
    retryable: true,
    maxRetries: 3,
    backoffMs: 1000
  },
  [ErrorCode.INVALID_CONFIGURATION]: {
    retryable: false,
    requiresUserInput: true
  },
  [ErrorCode.DELIVERY_FAILED]: {
    retryable: true,
    maxRetries: 5,
    backoffMs: 2000
  },
  [ErrorCode.RATE_LIMITED]: {
    retryable: true,
    maxRetries: 3,
    backoffMs: 5000
  },
  [ErrorCode.NOT_FOUND]: {
    retryable: false,
    requiresUserInput: true
  },
  [ErrorCode.VALIDATION_ERROR]: {
    retryable: false,
    requiresUserInput: true
  },
  [ErrorCode.UNAUTHORIZED]: {
    retryable: false,
    requiresUserInput: true
  },
  [ErrorCode.FORBIDDEN]: {
    retryable: false,
    requiresUserInput: true
  }
}; 
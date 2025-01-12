import { ErrorCode } from './types';

export interface ErrorRecoveryStrategy {
  retryable: boolean;
  requiresUserInput?: boolean;
  alternativeAction?: string;
  cleanup?: () => Promise<void>;
}

export const errorRecoveryStrategies: Record<ErrorCode, ErrorRecoveryStrategy> = {
  [ErrorCode.UNAUTHORIZED]: {
    retryable: true,
    requiresUserInput: true,
    alternativeAction: 'Please check your API credentials and try again.'
  },
  [ErrorCode.INVALID_INPUT]: {
    retryable: false,
    requiresUserInput: true,
    alternativeAction: 'Please check your input and try again.'
  },
  [ErrorCode.NOT_FOUND]: {
    retryable: false,
    requiresUserInput: true,
    alternativeAction: 'Please verify the resource exists and try again.'
  },
  [ErrorCode.RATE_LIMIT_EXCEEDED]: {
    retryable: true,
    alternativeAction: 'Please wait before retrying.'
  },
  [ErrorCode.SERVICE_UNAVAILABLE]: {
    retryable: true,
    alternativeAction: 'The service is temporarily unavailable. Please try again later.'
  },
  [ErrorCode.INTERNAL_ERROR]: {
    retryable: false,
    requiresUserInput: false,
    alternativeAction: 'Please contact support if the issue persists.'
  },
  [ErrorCode.NETWORK_ERROR]: {
    retryable: true,
    alternativeAction: 'Please check your network connection and try again.'
  },
  [ErrorCode.VALIDATION_ERROR]: {
    retryable: false,
    requiresUserInput: true,
    alternativeAction: 'Please check your input format and try again.'
  }
}; 
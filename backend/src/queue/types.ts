import type { NotionAssistantError } from '@/errors/types';

/**
 * Task status enum
 */
export enum TaskStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  DEAD_LETTER = 'dead_letter'
}

/**
 * Task priority levels
 */
export enum TaskPriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3
}

/**
 * Task result interface
 */
export interface TaskResult {
  success: boolean;
  data?: unknown;
  error?: NotionAssistantError;
}

/**
 * Task interface
 */
export interface Task {
  id: string;
  type: string;
  status: TaskStatus;
  priority: TaskPriority;
  description: string;
  created: Date;
  updated: Date;
  completed_at?: Date;
  deadline?: Date;
  retry_count: number;
  max_retries: number;
  error?: NotionAssistantError;
  result?: TaskResult;
  metadata?: Record<string, unknown>;
  dependencies?: string[];
  weight?: number;
  moved_to_dead_letter_at?: Date;
}

/**
 * Dead letter queue configuration
 */
export interface DeadLetterQueueConfig {
  maxSize: number;
  retentionPeriodMs: number;
  retryLimit: number;
  backoffMs: number;
} 
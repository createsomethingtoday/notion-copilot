import type { Task, TaskResult } from '../agent/types';
import type { StorageAdapter } from '../agent/storage/types';
import { Logger } from '../utils/logger';
import { NotionAssistantError, ErrorCode, ErrorSeverity, type ErrorRecoveryStrategy } from '../errors/types';
import { DEFAULT_RECOVERY_STRATEGIES } from '../errors/types';
import { CircuitBreaker } from '../utils/circuit-breaker';

export interface RecoveryOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  recoveryWindowMs?: number;
  healthCheckIntervalMs?: number;
  maxConcurrentRecoveries?: number;
  taskTimeoutMs?: number;
}

interface TaskHealthCheck {
  lastHeartbeat: Date;
  status: 'healthy' | 'warning' | 'critical';
  retryCount: number;
  error?: Error;
}

export class TaskRecoveryManager {
  private readonly logger: Logger;
  private readonly storage: StorageAdapter;
  private readonly options: Required<RecoveryOptions>;
  private healthCheckInterval?: NodeJS.Timeout;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly taskHealth: Map<string, TaskHealthCheck>;
  private recoveryInProgress: Set<string>;

  constructor(storage: StorageAdapter, options: RecoveryOptions = {}) {
    this.storage = storage;
    this.logger = new Logger('TaskRecoveryManager');
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryDelayMs: options.retryDelayMs ?? 5000,
      recoveryWindowMs: options.recoveryWindowMs ?? 30 * 60 * 1000, // 30 minutes
      healthCheckIntervalMs: options.healthCheckIntervalMs ?? 60 * 1000, // 1 minute
      maxConcurrentRecoveries: options.maxConcurrentRecoveries ?? 5,
      taskTimeoutMs: options.taskTimeoutMs ?? 5 * 60 * 1000 // 5 minutes
    };

    this.circuitBreaker = new CircuitBreaker('task-recovery', {
      maxFailures: 3,
      resetTimeoutMs: 60000,
      halfOpenMaxAttempts: 2,
      monitorIntervalMs: 30000
    }, this.logger);

    this.taskHealth = new Map();
    this.recoveryInProgress = new Set();
  }

  /**
   * Start recovery monitoring
   */
  start(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      this.options.healthCheckIntervalMs
    );

    this.logger.info('Recovery monitoring started', {
      checkInterval: this.options.healthCheckIntervalMs
    });
  }

  /**
   * Stop recovery monitoring
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      this.logger.info('Recovery monitoring stopped');
    }
    this.circuitBreaker.destroy();
  }

  /**
   * Register a task for health monitoring
   */
  registerTask(task: Task): void {
    this.taskHealth.set(task.id, {
      lastHeartbeat: new Date(),
      status: 'healthy',
      retryCount: 0
    });
  }

  /**
   * Update task heartbeat
   */
  updateHeartbeat(taskId: string): void {
    const health = this.taskHealth.get(taskId);
    if (health) {
      health.lastHeartbeat = new Date();
      health.status = 'healthy';
    }
  }

  /**
   * Perform health check and recover tasks if needed
   */
  private async performHealthCheck(): Promise<void> {
    try {
      await this.circuitBreaker.execute(async () => {
        const activeTasks = await this.storage.getActiveTasks();
        const now = Date.now();

        // Check task timeouts
        for (const task of activeTasks) {
          const health = this.taskHealth.get(task.id);
          if (!health) continue;

          const timeSinceHeartbeat = now - health.lastHeartbeat.getTime();
          if (timeSinceHeartbeat > this.options.taskTimeoutMs) {
            health.status = 'critical';
            await this.handleTaskTimeout(task, health);
          } else if (timeSinceHeartbeat > this.options.taskTimeoutMs / 2) {
            health.status = 'warning';
            this.logger.warn(`Task ${task.id} heartbeat delayed`, {
              taskType: task.type,
              timeSinceHeartbeat
            });
          }
        }

        // Clean up completed tasks
        for (const [taskId, health] of this.taskHealth.entries()) {
          const task = activeTasks.find(t => t.id === taskId);
          if (!task || task.status === 'completed' || task.status === 'failed') {
            this.taskHealth.delete(taskId);
            this.recoveryInProgress.delete(taskId);
          }
        }
      });
    } catch (error) {
      this.logger.error('Error during health check', error as Error);
    }
  }

  /**
   * Handle task timeout
   */
  private async handleTaskTimeout(task: Task, health: TaskHealthCheck): Promise<void> {
    if (this.recoveryInProgress.has(task.id)) return;
    if (this.recoveryInProgress.size >= this.options.maxConcurrentRecoveries) {
      this.logger.warn('Max concurrent recoveries reached, skipping recovery', {
        taskId: task.id
      });
      return;
    }

    this.recoveryInProgress.add(task.id);
    try {
      await this.recoverTask(task, new Error('Task timeout'));
    } finally {
      this.recoveryInProgress.delete(task.id);
    }
  }

  /**
   * Recover a failed or stuck task
   */
  private async recoverTask(task: Task, error: Error): Promise<void> {
    const health = this.taskHealth.get(task.id);
    if (!health) return;

    this.logger.info(`Attempting to recover task: ${task.id}`, {
      type: task.type,
      status: task.status,
      retryCount: health.retryCount
    });

    // Get recovery strategy
    const strategy = this.getRecoveryStrategy(task, error);
    if (!strategy.retryable || health.retryCount >= (strategy.maxRetries ?? this.options.maxRetries)) {
      await this.markTaskAsFailed(task, error);
      return;
    }

    // Execute cleanup if defined
    if (strategy.cleanup) {
      try {
        await strategy.cleanup();
      } catch (cleanupError) {
        this.logger.error('Error during task cleanup', cleanupError as Error);
      }
    }

    // Reset task for retry
    health.retryCount++;
    task.status = 'pending';
    task.error = new NotionAssistantError(
      error.message,
      ErrorCode.TASK_EXECUTION_FAILED,
      ErrorSeverity.ERROR,
      true,
      { originalError: error.message }
    );
    task.updated = new Date();

    await this.storage.updateTask(task.id, task);
    this.logger.info(`Task ${task.id} recovered and requeued`, {
      retryCount: health.retryCount
    });
  }

  /**
   * Get recovery strategy for a task
   */
  private getRecoveryStrategy(task: Task, error: Error): ErrorRecoveryStrategy {
    if (task.error && task.error instanceof NotionAssistantError) {
      const code = task.error.code;
      if (code in DEFAULT_RECOVERY_STRATEGIES) {
        return DEFAULT_RECOVERY_STRATEGIES[code];
      }
    }

    // Default strategy for unknown errors
    return {
      retryable: true,
      maxRetries: this.options.maxRetries,
      backoffMs: this.options.retryDelayMs
    };
  }

  /**
   * Mark a task as permanently failed
   */
  private async markTaskAsFailed(task: Task, error: Error): Promise<void> {
    task.status = 'failed';
    task.error = new NotionAssistantError(
      error.message,
      ErrorCode.TASK_EXECUTION_FAILED,
      ErrorSeverity.ERROR,
      false,
      { originalError: error.message }
    );
    task.updated = new Date();
    
    await this.storage.updateTask(task.id, task);
    this.taskHealth.delete(task.id);

    this.logger.warn(`Task ${task.id} marked as failed`, {
      type: task.type,
      error: error.message
    });
  }
} 
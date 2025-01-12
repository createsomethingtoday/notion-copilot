import type { Task } from './types';

export interface ConcurrencyLimits {
  maxConcurrentTasks: number;
  maxTasksPerType: Record<string, number>;
  rateLimits: {
    maxRequests: number;
    windowMs: number;
  };
}

export class ConcurrencyManager {
  private activeTasks: Map<string, Task> = new Map();
  private typeCounters: Map<string, number> = new Map();
  private requestTimestamps: number[] = [];
  private limits: ConcurrencyLimits;

  constructor(limits: Partial<ConcurrencyLimits> = {}) {
    this.limits = {
      maxConcurrentTasks: limits.maxConcurrentTasks ?? 5,
      maxTasksPerType: limits.maxTasksPerType ?? {
        search: 2,
        read: 3,
        write: 2,
        update: 2,
        delete: 1
      },
      rateLimits: limits.rateLimits ?? {
        maxRequests: 50,
        windowMs: 60000 // 1 minute
      }
    };
  }

  /**
   * Check if a task can be executed based on concurrency limits
   */
  private canExecuteTask(task: Task): boolean {
    // Check total concurrent tasks
    if (this.activeTasks.size >= this.limits.maxConcurrentTasks) {
      return false;
    }

    // Check per-type limits
    const currentTypeCount = this.typeCounters.get(task.type) ?? 0;
    const typeLimit = this.limits.maxTasksPerType[task.type] ?? 1;
    if (currentTypeCount >= typeLimit) {
      return false;
    }

    // Check rate limits
    const now = Date.now();
    const windowStart = now - this.limits.rateLimits.windowMs;
    const recentRequests = this.requestTimestamps.filter(t => t > windowStart);
    if (recentRequests.length >= this.limits.rateLimits.maxRequests) {
      return false;
    }

    return true;
  }

  /**
   * Try to acquire a concurrency slot for a task
   */
  async acquire(task: Task): Promise<boolean> {
    if (!this.canExecuteTask(task)) {
      return false;
    }

    // Update counters and tracking
    this.activeTasks.set(task.id, task);
    this.typeCounters.set(
      task.type,
      (this.typeCounters.get(task.type) ?? 0) + 1
    );
    this.requestTimestamps.push(Date.now());

    // Cleanup old timestamps
    const windowStart = Date.now() - this.limits.rateLimits.windowMs;
    this.requestTimestamps = this.requestTimestamps.filter(t => t > windowStart);

    return true;
  }

  /**
   * Release a concurrency slot for a task
   */
  async release(taskId: string): Promise<void> {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    this.activeTasks.delete(taskId);
    const currentTypeCount = this.typeCounters.get(task.type) ?? 1;
    this.typeCounters.set(task.type, currentTypeCount - 1);
  }

  /**
   * Get current concurrency metrics
   */
  getMetrics(): {
    activeTaskCount: number;
    typeCounters: Record<string, number>;
    recentRequestCount: number;
  } {
    const now = Date.now();
    const windowStart = now - this.limits.rateLimits.windowMs;
    const recentRequests = this.requestTimestamps.filter(t => t > windowStart);

    return {
      activeTaskCount: this.activeTasks.size,
      typeCounters: Object.fromEntries(this.typeCounters),
      recentRequestCount: recentRequests.length
    };
  }

  /**
   * Update concurrency limits
   */
  updateLimits(newLimits: Partial<ConcurrencyLimits>): void {
    this.limits = {
      ...this.limits,
      ...newLimits,
      maxTasksPerType: {
        ...this.limits.maxTasksPerType,
        ...newLimits.maxTasksPerType
      },
      rateLimits: {
        ...this.limits.rateLimits,
        ...newLimits.rateLimits
      }
    };
  }

  /**
   * Wait for a concurrency slot to become available
   */
  async waitForSlot(task: Task, timeoutMs = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (await this.acquire(task)) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return false;
  }
} 
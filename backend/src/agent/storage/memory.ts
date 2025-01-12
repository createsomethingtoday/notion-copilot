import type { Task, TaskResult } from '../types';
import type { StorageAdapter } from './types';

export class InMemoryStorage implements StorageAdapter {
  private tasks: Map<string, Task> = new Map();
  private results: Map<string, TaskResult> = new Map();
  private isInitialized = true;

  async saveTask(task: Task): Promise<void> {
    this.tasks.set(task.id, { ...task });
  }

  async getTask(taskId: string): Promise<Task | null> {
    const task = this.tasks.get(taskId);
    return task ? { ...task } : null;
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    
    this.tasks.set(taskId, { ...task, ...updates, updated: new Date() });
  }

  async deleteTask(taskId: string): Promise<void> {
    this.tasks.delete(taskId);
    this.results.delete(taskId);
  }

  async getQueuedTasks(limit?: number): Promise<Task[]> {
    const queued = Array.from(this.tasks.values())
      .filter(task => task.status === 'pending')
      .sort((a, b) => a.created.getTime() - b.created.getTime());
    
    return limit ? queued.slice(0, limit) : queued;
  }

  async getActiveTasks(): Promise<Task[]> {
    return Array.from(this.tasks.values())
      .filter(task => task.status === 'in_progress');
  }

  async saveResult(taskId: string, result: TaskResult): Promise<void> {
    this.results.set(taskId, { ...result });
  }

  async getResult(taskId: string): Promise<TaskResult | null> {
    const result = this.results.get(taskId);
    return result ? { ...result } : null;
  }

  async batchSaveTasks(tasks: Task[]): Promise<void> {
    for (const task of tasks) {
      await this.saveTask(task);
    }
  }

  async batchUpdateTasks(
    updates: Array<{ taskId: string; updates: Partial<Task> }>
  ): Promise<void> {
    for (const { taskId, updates: taskUpdates } of updates) {
      await this.updateTask(taskId, taskUpdates);
    }
  }

  async cleanup(olderThan: Date): Promise<void> {
    const threshold = olderThan.getTime();
    
    // Clean up completed/failed tasks
    for (const [taskId, task] of this.tasks.entries()) {
      if (
        (task.status === 'completed' || task.status === 'failed') &&
        task.updated.getTime() < threshold
      ) {
        this.tasks.delete(taskId);
        this.results.delete(taskId);
      }
    }
  }

  async isHealthy(): Promise<boolean> {
    return this.isInitialized;
  }
} 
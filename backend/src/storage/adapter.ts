import type { Task } from '@/queue/types';

/**
 * Interface for storage adapters (e.g. PostgreSQL, Redis)
 */
export interface StorageAdapter {
  // Task operations
  createTask(task: Task): Promise<void>;
  getTask(taskId: string): Promise<Task | null>;
  updateTask(task: Task): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
  getTasks(filter?: TaskFilter): Promise<Task[]>;
  
  // Dead letter queue operations
  getDeadLetterCount(): Promise<number>;
  getDeadLetterTasks(limit?: number): Promise<Task[]>;
  getDeadLetterTask(taskId: string): Promise<Task | null>;
  moveTaskToDeadLetter(task: Task): Promise<void>;
  removeFromDeadLetter(taskId: string): Promise<void>;
  cleanupDeadLetterTasks(threshold: Date): Promise<void>;
}

/**
 * Task filter options
 */
export interface TaskFilter {
  status?: string[];
  type?: string[];
  priority?: number[];
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
} 
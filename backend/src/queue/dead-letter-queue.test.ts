import { DeadLetterQueue } from './dead-letter-queue';
import { TaskStatus, TaskPriority } from './types';
import type { Task } from './types';
import type { StorageAdapter } from '../storage/adapter';
import { NotionAssistantError } from '@/errors/types';
import { ErrorCode, ErrorSeverity } from '@/errors/types';

describe('DeadLetterQueue', () => {
  let deadLetterQueue: DeadLetterQueue;
  let mockStorage: jest.Mocked<StorageAdapter>;
  const config = {
    maxSize: 100,
    retentionPeriodMs: 24 * 60 * 60 * 1000, // 24 hours
    retryLimit: 3,
    backoffMs: 1000
  };

  const mockTask: Task = {
    id: 'task-1',
    type: 'test',
    status: TaskStatus.FAILED,
    priority: TaskPriority.MEDIUM,
    description: 'Test task',
    created: new Date(),
    updated: new Date(),
    retry_count: 0,
    max_retries: 3
  };

  beforeEach(() => {
    mockStorage = {
      getDeadLetterCount: jest.fn(),
      getDeadLetterTasks: jest.fn(),
      getDeadLetterTask: jest.fn(),
      moveTaskToDeadLetter: jest.fn(),
      removeFromDeadLetter: jest.fn(),
      cleanupDeadLetterTasks: jest.fn(),
      createTask: jest.fn(),
      getTask: jest.fn(),
      updateTask: jest.fn(),
      deleteTask: jest.fn(),
      getTasks: jest.fn()
    };

    deadLetterQueue = new DeadLetterQueue(mockStorage, config);
  });

  describe('moveToDeadLetter', () => {
    it('should move a failed task to the dead letter queue', async () => {
      mockStorage.getDeadLetterCount.mockResolvedValue(0);

      await deadLetterQueue.moveToDeadLetter(mockTask);

      expect(mockTask.status).toBe(TaskStatus.DEAD_LETTER);
      expect(mockTask.moved_to_dead_letter_at).toBeDefined();
      expect(mockStorage.moveTaskToDeadLetter).toHaveBeenCalledWith(mockTask);
    });

    it('should throw when dead letter queue is full', async () => {
      mockStorage.getDeadLetterCount.mockResolvedValue(config.maxSize);

      await expect(deadLetterQueue.moveToDeadLetter(mockTask))
        .rejects
        .toThrow('Dead letter queue is full');
    });
  });

  describe('getTasks', () => {
    it('should retrieve tasks from dead letter queue', async () => {
      const mockTasks = [mockTask];
      mockStorage.getDeadLetterTasks.mockResolvedValue(mockTasks);

      const tasks = await deadLetterQueue.getTasks(10);

      expect(tasks).toEqual(mockTasks);
      expect(mockStorage.getDeadLetterTasks).toHaveBeenCalledWith(10);
    });
  });

  describe('retryTask', () => {
    it('should retry a task from dead letter queue', async () => {
      const task = { ...mockTask, status: TaskStatus.DEAD_LETTER };
      mockStorage.getDeadLetterTask.mockResolvedValue(task);

      await deadLetterQueue.retryTask(task.id);

      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.retry_count).toBe(1);
      expect(task.moved_to_dead_letter_at).toBeUndefined();
      expect(mockStorage.removeFromDeadLetter).toHaveBeenCalledWith(task.id);
    });

    it('should throw when task is not found', async () => {
      mockStorage.getDeadLetterTask.mockResolvedValue(null);

      await expect(deadLetterQueue.retryTask('non-existent'))
        .rejects
        .toThrow('Task not found in dead letter queue');
    });

    it('should throw when retry limit is exceeded', async () => {
      const task = { ...mockTask, retry_count: config.retryLimit };
      mockStorage.getDeadLetterTask.mockResolvedValue(task);

      await expect(deadLetterQueue.retryTask(task.id))
        .rejects
        .toThrow('Task retry limit exceeded');
    });
  });

  describe('cleanup', () => {
    it('should clean up old tasks', async () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      await deadLetterQueue.cleanup();

      const expectedThreshold = new Date(now - config.retentionPeriodMs);
      expect(mockStorage.cleanupDeadLetterTasks).toHaveBeenCalledWith(expectedThreshold);
    });
  });
}); 
import { DeadLetterQueue } from './dead-letter';
import { InMemoryStorage } from '../agent/storage/memory';
import type { Task } from '../agent/types';

describe('DeadLetterQueue', () => {
  let deadLetterQueue: DeadLetterQueue;
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
    deadLetterQueue = new DeadLetterQueue(storage);
  });

  describe('moveToDeadLetter', () => {
    it('should move a failed task to the dead letter queue', async () => {
      const task: Task = {
        id: 'test-task',
        type: 'read',
        status: 'failed',
        target: { type: 'page', id: 'page-id' }
      };
      const error = new Error('Test error');

      await deadLetterQueue.moveToDeadLetter(task, error);

      const deadLetterTasks = await storage.getDeadLetterTasks();
      expect(deadLetterTasks).toHaveLength(1);
      expect(deadLetterTasks[0].id).toBe(task.id);
      expect(deadLetterTasks[0].status).toBe('dead_letter');
      expect(deadLetterTasks[0].error).toBe(error);
      expect(deadLetterTasks[0].movedToDeadLetterAt).toBeDefined();
    });

    it('should throw error when dead letter queue is full', async () => {
      const dlq = new DeadLetterQueue(storage, { maxSize: 1 });
      
      // Fill the queue
      await dlq.moveToDeadLetter(
        {
          id: 'task-1',
          type: 'read',
          status: 'failed',
          target: { type: 'page', id: 'page-id' }
        },
        new Error('Error 1')
      );

      // Try to add another task
      await expect(
        dlq.moveToDeadLetter(
          {
            id: 'task-2',
            type: 'read',
            status: 'failed',
            target: { type: 'page', id: 'page-id' }
          },
          new Error('Error 2')
        )
      ).rejects.toThrow('Dead letter queue is full');
    });
  });

  describe('retryTask', () => {
    it('should move a task from dead letter queue back to main queue', async () => {
      const task: Task = {
        id: 'test-task',
        type: 'read',
        status: 'failed',
        target: { type: 'page', id: 'page-id' }
      };
      const error = new Error('Test error');

      await deadLetterQueue.moveToDeadLetter(task, error);
      await deadLetterQueue.retryTask(task.id);

      const deadLetterTasks = await storage.getDeadLetterTasks();
      expect(deadLetterTasks).toHaveLength(0);

      const retriedTask = await storage.getTask(task.id);
      expect(retriedTask).toBeDefined();
      expect(retriedTask?.status).toBe('pending');
      expect(retriedTask?.error).toBeUndefined();
      expect(retriedTask?.retryCount).toBe(0);
      expect(retriedTask?.movedToDeadLetterAt).toBeUndefined();
    });

    it('should throw error when task not found in dead letter queue', async () => {
      await expect(
        deadLetterQueue.retryTask('non-existent-task')
      ).rejects.toThrow('Task not found in dead letter queue');
    });
  });

  describe('cleanup', () => {
    it('should remove old tasks from dead letter queue', async () => {
      const oldTask: Task = {
        id: 'old-task',
        type: 'read',
        status: 'failed',
        target: { type: 'page', id: 'page-id' }
      };
      const newTask: Task = {
        id: 'new-task',
        type: 'read',
        status: 'failed',
        target: { type: 'page', id: 'page-id' }
      };

      // Move tasks to dead letter queue
      await deadLetterQueue.moveToDeadLetter(oldTask, new Error('Old error'));
      await deadLetterQueue.moveToDeadLetter(newTask, new Error('New error'));

      // Set old task's moved date to past threshold
      const oldTaskInDLQ = await storage.getDeadLetterTask(oldTask.id);
      if (oldTaskInDLQ?.movedToDeadLetterAt) {
        oldTaskInDLQ.movedToDeadLetterAt = new Date(
          Date.now() - (31 * 24 * 60 * 60 * 1000) // 31 days ago
        );
        await storage.moveTaskToDeadLetter(oldTaskInDLQ);
      }

      // Run cleanup
      await deadLetterQueue.cleanup();

      const remainingTasks = await storage.getDeadLetterTasks();
      expect(remainingTasks).toHaveLength(1);
      expect(remainingTasks[0].id).toBe(newTask.id);
    });
  });
}); 
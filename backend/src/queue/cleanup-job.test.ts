import { CleanupJob } from './cleanup-job';
import type { DeadLetterQueue } from './dead-letter-queue';
import type { MonitoringService } from '@/monitoring/service';
import type { Task } from './types';
import { TaskStatus, TaskPriority } from './types';

describe('CleanupJob', () => {
  let cleanupJob: CleanupJob;
  let mockDeadLetterQueue: jest.Mocked<DeadLetterQueue>;
  let mockMonitoring: jest.Mocked<MonitoringService>;
  const config = {
    intervalMs: 1000
  };

  const createMockTask = (id: string): Task => ({
    id,
    type: 'test',
    status: TaskStatus.FAILED,
    priority: TaskPriority.MEDIUM,
    description: 'Test task',
    created: new Date(),
    updated: new Date(),
    retry_count: 0,
    max_retries: 3
  });

  beforeEach(() => {
    jest.useFakeTimers();
    mockDeadLetterQueue = {
      cleanup: jest.fn(),
      getTasks: jest.fn()
    } as unknown as jest.Mocked<DeadLetterQueue>;

    mockMonitoring = {
      recordMetric: jest.fn(),
      incrementCounter: jest.fn()
    } as unknown as jest.Mocked<MonitoringService>;

    cleanupJob = new CleanupJob(mockDeadLetterQueue, config, mockMonitoring);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('start', () => {
    it('should start the cleanup job and run immediately', () => {
      mockDeadLetterQueue.getTasks.mockResolvedValue([]);
      cleanupJob.start();

      expect(mockDeadLetterQueue.cleanup).toHaveBeenCalledTimes(1);
    });

    it('should schedule recurring cleanup', () => {
      mockDeadLetterQueue.getTasks.mockResolvedValue([]);
      cleanupJob.start();
      mockDeadLetterQueue.cleanup.mockClear();

      // Fast forward one interval
      jest.advanceTimersByTime(config.intervalMs);
      expect(mockDeadLetterQueue.cleanup).toHaveBeenCalledTimes(1);

      // Fast forward another interval
      jest.advanceTimersByTime(config.intervalMs);
      expect(mockDeadLetterQueue.cleanup).toHaveBeenCalledTimes(2);
    });

    it('should not start if already running', () => {
      mockDeadLetterQueue.getTasks.mockResolvedValue([]);
      cleanupJob.start();
      mockDeadLetterQueue.cleanup.mockClear();

      cleanupJob.start();
      expect(mockDeadLetterQueue.cleanup).not.toHaveBeenCalled();
    });

    it('should record metrics for successful cleanup', async () => {
      const mockTasks = [createMockTask('1'), createMockTask('2')];
      mockDeadLetterQueue.getTasks
        .mockResolvedValueOnce(mockTasks)
        .mockResolvedValueOnce([createMockTask('1')]);

      cleanupJob.start();
      await Promise.resolve(); // Let async cleanup complete

      expect(mockMonitoring.recordMetric).toHaveBeenCalledWith(
        'dlq_tasks_cleaned',
        1,
        undefined
      );
      expect(mockMonitoring.recordMetric).toHaveBeenCalledWith(
        'dlq_tasks_remaining',
        1,
        undefined
      );
      expect(mockMonitoring.incrementCounter).toHaveBeenCalledWith(
        'dlq_cleanup_success',
        undefined
      );
    });
  });

  describe('stop', () => {
    it('should stop the cleanup job', () => {
      mockDeadLetterQueue.getTasks.mockResolvedValue([]);
      cleanupJob.start();
      mockDeadLetterQueue.cleanup.mockClear();

      cleanupJob.stop();
      jest.advanceTimersByTime(config.intervalMs);
      expect(mockDeadLetterQueue.cleanup).not.toHaveBeenCalled();
    });

    it('should do nothing if not running', () => {
      cleanupJob.stop();
      jest.advanceTimersByTime(config.intervalMs);
      expect(mockDeadLetterQueue.cleanup).not.toHaveBeenCalled();
    });
  });

  describe('runCleanup', () => {
    it('should handle cleanup errors', async () => {
      const error = new Error('Cleanup failed');
      mockDeadLetterQueue.cleanup.mockRejectedValueOnce(error);
      mockDeadLetterQueue.getTasks.mockResolvedValue([]);

      cleanupJob.start();
      await Promise.resolve(); // Let async cleanup complete

      expect(mockDeadLetterQueue.cleanup).toHaveBeenCalled();
      expect(mockMonitoring.incrementCounter).toHaveBeenCalledWith(
        'dlq_cleanup_failure',
        undefined
      );

      // Job should continue running despite error
      jest.advanceTimersByTime(config.intervalMs);
      expect(mockDeadLetterQueue.cleanup).toHaveBeenCalledTimes(2);
    });
  });
}); 
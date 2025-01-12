import type { Task } from '../agent/types';
import type { PostgresAdapter } from '../db/postgres';
import { Logger } from '../utils/logger';
import type { TaskExecutor } from './executor';
import { Worker } from './worker';
import type { WorkerConfig } from './worker';

export interface WorkerPoolConfig {
  minWorkers: number;
  maxWorkers: number;
  workerConfig?: Omit<WorkerConfig, 'id'>;
}

export class WorkerPool {
  private readonly workers: Map<string, Worker> = new Map();
  private readonly logger: Logger;
  private readonly db: PostgresAdapter;
  private readonly executor: TaskExecutor;
  private readonly config: WorkerPoolConfig;

  constructor(db: PostgresAdapter, executor: TaskExecutor, config: WorkerPoolConfig) {
    this.db = db;
    this.executor = executor;
    this.config = config;
    this.logger = new Logger('WorkerPool');
  }

  /**
   * Start the worker pool
   */
  async start(): Promise<void> {
    this.logger.info('Starting worker pool', {
      minWorkers: this.config.minWorkers,
      maxWorkers: this.config.maxWorkers
    });

    // Start minimum number of workers
    for (let i = 0; i < this.config.minWorkers; i++) {
      await this.addWorker();
    }

    // Start monitoring queue size for auto-scaling
    this.startQueueMonitoring();
  }

  /**
   * Stop the worker pool
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping worker pool');

    // Stop all workers
    const stopPromises = Array.from(this.workers.values()).map(worker => worker.stop());
    await Promise.all(stopPromises);

    this.workers.clear();
  }

  /**
   * Add a new worker to the pool
   */
  private async addWorker(): Promise<Worker> {
    const workerId = `worker-${this.workers.size + 1}`;
    const worker = new Worker(this.db, this.executor, {
      id: workerId,
      ...this.config.workerConfig
    });

    // Set up event handlers
    worker.on('taskStarted', (task: Task) => {
      this.logger.debug(`Worker ${workerId} started task: ${task.id}`);
    });

    worker.on('taskCompleted', (task: Task) => {
      this.logger.debug(`Worker ${workerId} completed task: ${task.id}`);
    });

    worker.on('taskFailed', (task: Task, error: Error) => {
      this.logger.error(`Worker ${workerId} failed task: ${task.id}`, error);
    });

    // Start the worker
    await worker.start();
    this.workers.set(workerId, worker);
    this.logger.info(`Added worker: ${workerId}`);

    return worker;
  }

  /**
   * Remove a worker from the pool
   */
  private async removeWorker(): Promise<void> {
    const [workerId, worker] = Array.from(this.workers.entries())[0];
    if (!worker) return;

    await worker.stop();
    this.workers.delete(workerId);
    this.logger.info(`Removed worker: ${workerId}`);
  }

  /**
   * Start monitoring queue size for auto-scaling
   */
  private startQueueMonitoring(): void {
    const QUEUE_CHECK_INTERVAL = 10000; // 10 seconds
    const HIGH_WATER_MARK = 100; // Tasks per worker
    const LOW_WATER_MARK = 10; // Tasks per worker

    setInterval(async () => {
      try {
        const queueSize = await this.db.getQueueSize();
        const workerCount = this.workers.size;
        const tasksPerWorker = queueSize / workerCount;

        this.logger.debug('Queue monitoring', {
          queueSize,
          workerCount,
          tasksPerWorker
        });

        // Scale up if queue is too large
        if (
          tasksPerWorker > HIGH_WATER_MARK &&
          workerCount < this.config.maxWorkers
        ) {
          await this.addWorker();
          return;
        }

        // Scale down if queue is too small
        if (
          tasksPerWorker < LOW_WATER_MARK &&
          workerCount > this.config.minWorkers
        ) {
          await this.removeWorker();
          return;
        }
      } catch (error) {
        this.logger.error('Error monitoring queue', error as Error);
      }
    }, QUEUE_CHECK_INTERVAL);
  }

  /**
   * Get pool status
   */
  getStatus(): {
    workerCount: number;
    workers: Array<{
      id: string;
      isRunning: boolean;
      currentTask?: { id: string; type: string };
    }>;
  } {
    return {
      workerCount: this.workers.size,
      workers: Array.from(this.workers.values()).map(worker => worker.getStatus())
    };
  }
} 
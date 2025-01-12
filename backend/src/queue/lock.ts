import type { PostgresAdapter } from '../db/postgres';
import { Logger } from '../utils/logger';

export interface LockOptions {
  lockTimeoutMs?: number;
  retryIntervalMs?: number;
  maxRetries?: number;
}

export class DistributedLockManager {
  private readonly db: PostgresAdapter;
  private readonly logger: Logger;
  private readonly options: Required<LockOptions>;
  private readonly activeLocks: Set<string> = new Set();

  constructor(db: PostgresAdapter, options: LockOptions = {}) {
    this.db = db;
    this.logger = new Logger('DistributedLockManager');
    this.options = {
      lockTimeoutMs: options.lockTimeoutMs ?? 30000, // 30 seconds
      retryIntervalMs: options.retryIntervalMs ?? 100, // 100ms
      maxRetries: options.maxRetries ?? 50 // 5 seconds total with default interval
    };
  }

  /**
   * Acquire a distributed lock
   * @param lockKey - Unique identifier for the lock
   * @returns true if lock was acquired, false otherwise
   */
  async acquireLock(lockKey: string): Promise<boolean> {
    const lockId = this.hashKey(lockKey);

    try {
      // Try to acquire PostgreSQL advisory lock
      const result = await this.db.tryAdvisoryLock(lockId);
      if (result) {
        this.activeLocks.add(lockKey);
        this.logger.debug(`Acquired lock: ${lockKey}`);
      }
      return result;
    } catch (error) {
      this.logger.error(`Error acquiring lock: ${lockKey}`, error as Error);
      return false;
    }
  }

  /**
   * Release a distributed lock
   * @param lockKey - Unique identifier for the lock
   */
  async releaseLock(lockKey: string): Promise<void> {
    const lockId = this.hashKey(lockKey);

    try {
      // Release PostgreSQL advisory lock
      await this.db.releaseAdvisoryLock(lockId);
      this.activeLocks.delete(lockKey);
      this.logger.debug(`Released lock: ${lockKey}`);
    } catch (error) {
      this.logger.error(`Error releasing lock: ${lockKey}`, error as Error);
    }
  }

  /**
   * Wait for a lock to become available
   * @param lockKey - Unique identifier for the lock
   * @returns true if lock was acquired, false if timeout was reached
   */
  async waitForLock(lockKey: string): Promise<boolean> {
    let attempts = 0;
    const startTime = Date.now();

    while (attempts < this.options.maxRetries) {
      if (await this.acquireLock(lockKey)) {
        return true;
      }

      // Check if we've exceeded timeout
      if (Date.now() - startTime > this.options.lockTimeoutMs) {
        this.logger.warn(`Lock timeout reached for: ${lockKey}`);
        return false;
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, this.options.retryIntervalMs));
      attempts++;
    }

    this.logger.warn(`Max retry attempts reached for lock: ${lockKey}`);
    return false;
  }

  /**
   * Check if a lock is currently held
   * @param lockKey - Unique identifier for the lock
   */
  async isLocked(lockKey: string): Promise<boolean> {
    const lockId = this.hashKey(lockKey);

    try {
      return await this.db.checkAdvisoryLock(lockId);
    } catch (error) {
      this.logger.error(`Error checking lock status: ${lockKey}`, error as Error);
      return false;
    }
  }

  /**
   * Release all locks held by this instance
   */
  async releaseAllLocks(): Promise<void> {
    const locks = Array.from(this.activeLocks);
    await Promise.all(locks.map(lock => this.releaseLock(lock)));
  }

  /**
   * Convert lock key to a 32-bit integer for PostgreSQL advisory locks
   */
  private hashKey(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
} 
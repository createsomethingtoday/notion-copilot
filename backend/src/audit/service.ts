import { randomUUID } from 'node:crypto';
import { Logger } from '../utils/logger';
import { NotionAssistantError, ErrorCode, ErrorSeverity } from '../errors/types';
import {
  type AuditEvent,
  type AuditEventType,
  AuditEventSeverity,
  type AuditEventMetadata,
  type AuditEventQuery,
  type AuditStorage
} from './types';

export interface AuditServiceOptions {
  storage: AuditStorage;
  retentionDays?: number;
  batchSize?: number;
  flushIntervalMs?: number;
}

export class AuditService {
  private readonly logger: Logger;
  private readonly storage: AuditStorage;
  private readonly options: Required<AuditServiceOptions>;
  private readonly eventQueue: AuditEvent[] = [];
  private flushTimeout?: NodeJS.Timeout;
  private isShuttingDown = false;

  constructor(options: AuditServiceOptions) {
    this.logger = new Logger('AuditService');
    this.storage = options.storage;
    this.options = {
      storage: options.storage,
      retentionDays: options.retentionDays ?? 90,
      batchSize: options.batchSize ?? 100,
      flushIntervalMs: options.flushIntervalMs ?? 1000
    };

    // Start cleanup job
    this.startCleanupJob();
  }

  /**
   * Create and save an audit event
   */
  async createEvent(
    type: AuditEventType,
    message: string,
    metadata: AuditEventMetadata = {},
    options: {
      severity?: AuditEventSeverity;
      correlationId?: string;
      parentEventId?: string;
      immediate?: boolean;
    } = {}
  ): Promise<string> {
    const event: AuditEvent = {
      id: randomUUID(),
      type,
      severity: options.severity ?? AuditEventSeverity.INFO,
      timestamp: new Date(),
      message,
      metadata,
      correlationId: options.correlationId,
      parentEventId: options.parentEventId
    };

    if (options.immediate) {
      await this.storage.saveEvent(event);
    } else {
      this.queueEvent(event);
    }

    return event.id;
  }

  /**
   * Queue an event for batch processing
   */
  private queueEvent(event: AuditEvent): void {
    this.eventQueue.push(event);

    if (this.eventQueue.length >= this.options.batchSize) {
      this.flush().catch(err => {
        this.logger.error('Failed to flush audit events', { 
          errorMessage: err instanceof Error ? err.message : String(err)
        });
      });
    } else if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => {
        this.flush().catch(err => {
          this.logger.error('Failed to flush audit events', { 
            errorMessage: err instanceof Error ? err.message : String(err)
          });
        });
      }, this.options.flushIntervalMs);
    }
  }

  /**
   * Flush queued events to storage
   */
  private async flush(): Promise<void> {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = undefined;
    }

    if (this.eventQueue.length === 0) return;

    const events = [...this.eventQueue];
    this.eventQueue.length = 0;

    try {
      await Promise.all(events.map(event => this.storage.saveEvent(event)));
    } catch (err) {
      // On error, requeue events that weren't saved
      if (!this.isShuttingDown) {
        this.eventQueue.push(...events);
      }
      throw new NotionAssistantError(
        'Failed to flush audit events',
        ErrorCode.INTERNAL_ERROR,
        ErrorSeverity.ERROR,
        true,
        { errorMessage: err instanceof Error ? err.message : String(err) }
      );
    }
  }

  /**
   * Query audit events
   */
  async queryEvents(query: AuditEventQuery): Promise<AuditEvent[]> {
    return this.storage.getEvents(query);
  }

  /**
   * Get a single audit event by ID
   */
  async getEventById(id: string): Promise<AuditEvent | null> {
    return this.storage.getEventById(id);
  }

  /**
   * Start the cleanup job for old events
   */
  private startCleanupJob(): void {
    // Run cleanup every day at midnight
    const runCleanup = async () => {
      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - this.options.retentionDays);

        const deletedCount = await this.storage.deleteEvents({
          endTime: cutoff
        });

        this.logger.info('Cleaned up old audit events', { deletedCount });
      } catch (err) {
        this.logger.error('Failed to clean up audit events', { 
          errorMessage: err instanceof Error ? err.message : String(err)
        });
      }
    };

    const now = new Date();
    const midnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1
    );
    const msUntilMidnight = midnight.getTime() - now.getTime();

    // Schedule first run
    setTimeout(() => {
      runCleanup().catch(err => {
        this.logger.error('Failed to run initial cleanup', { 
          errorMessage: err instanceof Error ? err.message : String(err)
        });
      });

      // Schedule subsequent runs
      setInterval(() => {
        runCleanup().catch(err => {
          this.logger.error('Failed to run scheduled cleanup', { 
            errorMessage: err instanceof Error ? err.message : String(err)
          });
        });
      }, 24 * 60 * 60 * 1000); // 24 hours
    }, msUntilMidnight);
  }

  /**
   * Gracefully shut down the service
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = undefined;
    }

    if (this.eventQueue.length > 0) {
      try {
        await this.flush();
      } catch (err) {
        this.logger.error('Failed to flush events during shutdown', { 
          errorMessage: err instanceof Error ? err.message : String(err)
        });
      }
    }
  }
} 
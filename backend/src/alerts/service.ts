import { randomUUID } from 'node:crypto';
import type { Logger } from '../utils/logger';
import { NotionAssistantError, ErrorCode, ErrorSeverity } from '../errors/types';
import type { AuditEvent } from '../audit/types';
import {
  AlertStatus,
  type Alert,
  type AlertRule,
  type AlertStorage,
  type AlertServiceOptions
} from './types';

export class AlertService {
  private readonly storage: AlertStorage;
  private readonly logger: Logger;
  private readonly retryDelayMs: number;
  private readonly maxRetries: number;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private flushInterval: NodeJS.Timeout | null;
  private isShuttingDown: boolean;

  constructor(options: AlertServiceOptions) {
    this.storage = options.storage;
    this.logger = options.logger;
    this.retryDelayMs = options.retryDelayMs;
    this.maxRetries = options.maxRetries;
    this.batchSize = options.batchSize;
    this.flushIntervalMs = options.flushIntervalMs;
    this.flushInterval = null;
    this.isShuttingDown = false;

    this.startFlushInterval();
  }

  private startFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    this.flushInterval = setInterval(async () => {
      try {
        await this.flushPendingAlerts();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error('Failed to flush pending alerts', { errorMessage });
      }
    }, this.flushIntervalMs);
  }

  private async flushPendingAlerts(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    const pendingAlerts = await this.storage.getAlerts({
      status: AlertStatus.PENDING
    });

    for (let i = 0; i < pendingAlerts.length; i += this.batchSize) {
      const batch = pendingAlerts.slice(i, i + this.batchSize);
      await Promise.all(batch.map(alert => this.deliverAlert(alert.id)));
    }
  }

  async createRule(rule: AlertRule): Promise<void> {
    try {
      await this.storage.saveRule(rule);
      this.logger.info('Created alert rule', { ruleId: rule.id });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to create alert rule', {
        ruleId: rule.id,
        errorMessage
      });
      throw new NotionAssistantError(
        'Failed to create alert rule',
        ErrorCode.INTERNAL_ERROR,
        ErrorSeverity.ERROR,
        true,
        { errorMessage }
      );
    }
  }

  async processEvent(event: AuditEvent): Promise<void> {
    try {
      const rules = await this.storage.getRules({ enabled: true });
      const matchingRules = rules.filter(rule =>
        this.doesEventMatchRule(event, rule)
      );

      for (const rule of matchingRules) {
        const alert: Alert = {
          id: randomUUID(),
          ruleId: rule.id,
          eventId: event.id,
          status: AlertStatus.PENDING,
          channels: rule.channels.map(channel => channel.type),
          attempts: 0,
          firstAttempt: new Date(),
          metadata: {
            eventType: event.type,
            eventSeverity: event.severity,
            ...event.metadata
          }
        };

        await this.storage.saveAlert(alert);
        this.logger.info('Created alert', {
          alertId: alert.id,
          ruleId: rule.id,
          eventId: event.id
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to process event', {
        eventId: event.id,
        errorMessage
      });
      throw new NotionAssistantError(
        'Failed to process event',
        ErrorCode.INTERNAL_ERROR,
        ErrorSeverity.ERROR,
        true,
        { errorMessage }
      );
    }
  }

  private doesEventMatchRule(event: AuditEvent, rule: AlertRule): boolean {
    if (!rule.eventTypes.includes(event.type)) {
      return false;
    }

    if (!rule.severities.includes(event.severity)) {
      return false;
    }

    for (const condition of rule.conditions) {
      if (!condition.field) {
        continue;
      }
      const value = this.getValueFromEvent(event, condition.field);
      if (!this.evaluateCondition(condition, value)) {
        return false;
      }
    }

    return true;
  }

  private getValueFromEvent(event: AuditEvent, field: string): unknown {
    switch (field) {
      case 'type':
        return event.type;
      case 'severity':
        return event.severity;
      case 'message':
        return event.message;
      default:
        return event.metadata?.[field];
    }
  }

  private evaluateCondition(
    condition: AlertRule['conditions'][number],
    value: unknown
  ): boolean {
    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'neq':
        return value !== condition.value;
      case 'gt':
        return typeof value === 'number' && value > Number(condition.value);
      case 'gte':
        return typeof value === 'number' && value >= Number(condition.value);
      case 'lt':
        return typeof value === 'number' && value < Number(condition.value);
      case 'lte':
        return typeof value === 'number' && value <= Number(condition.value);
      case 'contains':
        return typeof value === 'string' && value.includes(String(condition.value));
      case 'matches':
        return typeof value === 'string' && new RegExp(String(condition.value)).test(value);
      default:
        return false;
    }
  }

  async deliverAlert(alertId: string): Promise<void> {
    try {
      const alert = await this.storage.getAlert(alertId);
      if (!alert) {
        throw new Error('Alert not found');
      }

      const rule = await this.storage.getRule(alert.ruleId);
      if (!rule) {
        throw new Error('Rule not found');
      }

      if (alert.attempts >= this.maxRetries) {
        await this.storage.updateAlertStatus(alertId, AlertStatus.RATE_LIMITED);
        this.logger.warn('Alert rate limited', {
          alertId,
          ruleId: rule.id,
          attempts: alert.attempts
        });
        return;
      }

      // TODO: Implement actual delivery logic for each channel
      await this.storage.updateAlertStatus(alertId, AlertStatus.DELIVERED);
      this.logger.info('Alert delivered', {
        alertId,
        ruleId: rule.id,
        channels: alert.channels
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to deliver alert', {
        alertId,
        errorMessage
      });
      await this.storage.updateAlertStatus(
        alertId,
        AlertStatus.FAILED,
        errorMessage
      );
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Alert service shutting down');
    this.isShuttingDown = true;

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    try {
      await this.flushPendingAlerts();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Error during shutdown', { errorMessage });
    }
  }
} 
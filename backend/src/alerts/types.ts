import type { AuditEventType, AuditEventSeverity } from '../audit/types';
import type { Logger } from '../utils/logger';

export enum AlertChannel {
  WEBHOOK = 'webhook',
  EMAIL = 'email',
  SLACK = 'slack'
}

export enum AlertStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RATE_LIMITED = 'rate_limited'
}

export interface AlertServiceOptions {
  storage: AlertStorage;
  logger: Logger;
  retryDelayMs: number;
  maxRetries: number;
  batchSize: number;
  flushIntervalMs: number;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  eventTypes: AuditEventType[];
  severities: AuditEventSeverity[];
  conditions: AlertCondition[];
  channels: AlertChannelConfig[];
  rateLimitMs?: number;
  cooldownMs?: number;
  metadata?: Record<string, unknown>;
  created: Date;
  updated: Date;
}

export interface AlertCondition {
  type: 'threshold' | 'pattern' | 'frequency';
  field: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'contains' | 'matches';
  value: number | string | boolean;
  timeWindowMs?: number;
  minOccurrences?: number;
}

export interface AlertChannelConfig {
  type: AlertChannel;
  config: WebhookConfig | EmailConfig | SlackConfig;
  enabled: boolean;
}

export interface WebhookConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
  retryConfig?: {
    maxRetries: number;
    backoffMs: number;
  };
}

export interface EmailConfig {
  recipients: string[];
  templateId?: string;
}

export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
}

export interface Alert {
  id: string;
  ruleId: string;
  eventId: string;
  status: AlertStatus;
  channels: AlertChannel[];
  attempts: number;
  firstAttempt: Date;
  lastAttempt?: Date;
  deliveredAt?: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface AlertStorage {
  saveRule(rule: AlertRule): Promise<void>;
  getRule(id: string): Promise<AlertRule | null>;
  getRules(filter?: Partial<AlertRule>): Promise<AlertRule[]>;
  deleteRule(id: string): Promise<void>;
  saveAlert(alert: Alert): Promise<void>;
  getAlert(id: string): Promise<Alert | null>;
  getAlerts(filter?: Partial<Alert>): Promise<Alert[]>;
  updateAlertStatus(id: string, status: AlertStatus, error?: string): Promise<void>;
} 
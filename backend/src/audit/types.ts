export enum AuditEventType {
  // System Events
  SYSTEM_STARTUP = 'system.startup',
  SYSTEM_SHUTDOWN = 'system.shutdown',
  SYSTEM_ERROR = 'system.error',
  SYSTEM_RECOVERY = 'system.recovery',
  
  // Task Events
  TASK_CREATED = 'task.created',
  TASK_UPDATED = 'task.updated',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',
  TASK_RECOVERED = 'task.recovered',
  TASK_ARCHIVED = 'task.archived',
  TASK_REPLAYED = 'task.replayed',
  
  // Security Events
  USER_LOGIN = 'security.login',
  USER_LOGOUT = 'security.logout',
  USER_CREATED = 'security.user_created',
  USER_UPDATED = 'security.user_updated',
  AUTH_FAILED = 'security.auth_failed',
  RATE_LIMIT_EXCEEDED = 'security.rate_limit',
  
  // Recovery Events
  CIRCUIT_BREAKER_OPEN = 'recovery.circuit_breaker_open',
  CIRCUIT_BREAKER_HALF_OPEN = 'recovery.circuit_breaker_half_open',
  CIRCUIT_BREAKER_CLOSED = 'recovery.circuit_breaker_closed',
  RECOVERY_ATTEMPTED = 'recovery.attempted',
  RECOVERY_SUCCEEDED = 'recovery.succeeded',
  RECOVERY_FAILED = 'recovery.failed',
  
  // Performance Events
  PERFORMANCE_DEGRADED = 'performance.degraded',
  PERFORMANCE_RECOVERED = 'performance.recovered',
  RESOURCE_EXHAUSTED = 'performance.resource_exhausted',
  
  // Data Events
  DATA_BACKUP_STARTED = 'data.backup_started',
  DATA_BACKUP_COMPLETED = 'data.backup_completed',
  DATA_RESTORE_STARTED = 'data.restore_started',
  DATA_RESTORE_COMPLETED = 'data.restore_completed',
  DATA_CORRUPTED = 'data.corrupted',
  
  // Integration Events
  NOTION_API_ERROR = 'integration.notion_error',
  NOTION_API_RECOVERED = 'integration.notion_recovered',
  OPENAI_API_ERROR = 'integration.openai_error',
  OPENAI_API_RECOVERED = 'integration.openai_recovered'
}

export enum AuditEventSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface AuditEventMetadata {
  userId?: string;
  taskId?: string;
  resourceId?: string;
  errorCode?: string;
  errorMessage?: string;
  duration?: number;
  retryCount?: number;
  ipAddress?: string;
  userAgent?: string;
  region?: string;
  tags?: Record<string, string>;
  [key: string]: unknown;
}

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  severity: AuditEventSeverity;
  timestamp: Date;
  message: string;
  metadata: AuditEventMetadata;
  correlationId?: string;
  parentEventId?: string;
}

export interface AuditEventQuery {
  startTime?: Date;
  endTime?: Date;
  types?: AuditEventType[];
  severities?: AuditEventSeverity[];
  userId?: string;
  taskId?: string;
  resourceId?: string;
  correlationId?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp' | 'severity';
  orderDirection?: 'asc' | 'desc';
}

export interface AuditStorage {
  saveEvent(event: AuditEvent): Promise<void>;
  getEvents(query: AuditEventQuery): Promise<AuditEvent[]>;
  getEventById(id: string): Promise<AuditEvent | null>;
  deleteEvents(query: AuditEventQuery): Promise<number>;
} 
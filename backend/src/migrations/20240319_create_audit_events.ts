import type { MigrationFn, MigrationBuilder } from 'node-pg-migrate';

export const up: MigrationFn = async (pgm: MigrationBuilder): Promise<void> => {
  // Create enum types
  pgm.createType('audit_event_type', {
    values: [
      'system.startup',
      'system.shutdown',
      'system.error',
      'system.recovery',
      'task.created',
      'task.updated',
      'task.completed',
      'task.failed',
      'task.recovered',
      'task.archived',
      'task.replayed',
      'security.login',
      'security.logout',
      'security.user_created',
      'security.user_updated',
      'security.auth_failed',
      'security.rate_limit',
      'recovery.circuit_breaker_open',
      'recovery.circuit_breaker_half_open',
      'recovery.circuit_breaker_closed',
      'recovery.attempted',
      'recovery.succeeded',
      'recovery.failed',
      'performance.degraded',
      'performance.recovered',
      'performance.resource_exhausted',
      'data.backup_started',
      'data.backup_completed',
      'data.restore_started',
      'data.restore_completed',
      'data.corrupted',
      'integration.notion_error',
      'integration.notion_recovered',
      'integration.openai_error',
      'integration.openai_recovered'
    ]
  });

  pgm.createType('audit_event_severity', {
    values: [
      'debug',
      'info',
      'warning',
      'error',
      'critical'
    ]
  });

  // Create audit events table
  pgm.createTable('audit_events', {
    id: {
      type: 'uuid',
      primaryKey: true
    },
    type: {
      type: 'audit_event_type',
      notNull: true
    },
    severity: {
      type: 'audit_event_severity',
      notNull: true
    },
    timestamp: {
      type: 'timestamp with time zone',
      notNull: true
    },
    message: {
      type: 'text',
      notNull: true
    },
    metadata: {
      type: 'jsonb',
      notNull: true,
      default: '{}'
    },
    correlation_id: {
      type: 'uuid'
    },
    parent_event_id: {
      type: 'uuid',
      references: 'audit_events',
      onDelete: 'SET NULL'
    }
  });

  // Create indexes
  pgm.createIndex('audit_events', 'timestamp');
  pgm.createIndex('audit_events', 'type');
  pgm.createIndex('audit_events', 'severity');
  pgm.createIndex('audit_events', 'correlation_id');
  pgm.createIndex('audit_events', ['metadata->>"userId"'], {
    name: 'idx_audit_events_user_id'
  });
  pgm.createIndex('audit_events', ['metadata->>"taskId"'], {
    name: 'idx_audit_events_task_id'
  });
  pgm.createIndex('audit_events', ['metadata->>"resourceId"'], {
    name: 'idx_audit_events_resource_id'
  });
};

export const down: MigrationFn = async (pgm: MigrationBuilder): Promise<void> => {
  // Drop indexes
  pgm.dropIndex('audit_events', ['metadata->>"resourceId"'], {
    name: 'idx_audit_events_resource_id'
  });
  pgm.dropIndex('audit_events', ['metadata->>"taskId"'], {
    name: 'idx_audit_events_task_id'
  });
  pgm.dropIndex('audit_events', ['metadata->>"userId"'], {
    name: 'idx_audit_events_user_id'
  });
  pgm.dropIndex('audit_events', 'correlation_id');
  pgm.dropIndex('audit_events', 'severity');
  pgm.dropIndex('audit_events', 'type');
  pgm.dropIndex('audit_events', 'timestamp');

  // Drop table
  pgm.dropTable('audit_events');

  // Drop enum types
  pgm.dropType('audit_event_severity');
  pgm.dropType('audit_event_type');
}; 
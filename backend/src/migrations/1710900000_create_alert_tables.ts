import type { MigrationFn, MigrationBuilder } from 'node-pg-migrate';

export const up: MigrationFn = async (pgm: MigrationBuilder): Promise<void> => {
  // Create alert_rules table
  pgm.createTable('alert_rules', {
    id: { type: 'uuid', primaryKey: true },
    name: { type: 'varchar(255)', notNull: true },
    description: { type: 'text' },
    enabled: { type: 'boolean', notNull: true, default: true },
    event_types: { type: 'jsonb', notNull: true },
    severities: { type: 'jsonb', notNull: true },
    conditions: { type: 'jsonb', notNull: true },
    channels: { type: 'jsonb', notNull: true },
    rate_limit_ms: { type: 'integer', notNull: true },
    cooldown_ms: { type: 'integer', notNull: true },
    metadata: { type: 'jsonb' },
    created: { type: 'timestamp with time zone', notNull: true, default: pgm.func('NOW()') },
    updated: { type: 'timestamp with time zone', notNull: true, default: pgm.func('NOW()') }
  });

  // Create indexes for alert_rules
  pgm.createIndex('alert_rules', 'enabled');
  pgm.createIndex('alert_rules', 'event_types', { method: 'gin' });
  pgm.createIndex('alert_rules', 'severities', { method: 'gin' });
  pgm.createIndex('alert_rules', 'created');
  pgm.createIndex('alert_rules', 'updated');

  // Create alerts table
  pgm.createTable('alerts', {
    id: { type: 'uuid', primaryKey: true },
    rule_id: { type: 'uuid', notNull: true, references: 'alert_rules' },
    event_id: { type: 'uuid', notNull: true, references: 'audit_events' },
    status: { type: 'varchar(50)', notNull: true },
    channels: { type: 'jsonb', notNull: true },
    attempts: { type: 'integer', notNull: true, default: 0 },
    first_attempt: { type: 'timestamp with time zone', notNull: true, default: pgm.func('NOW()') },
    last_attempt: { type: 'timestamp with time zone', notNull: true, default: pgm.func('NOW()') },
    delivered_at: { type: 'timestamp with time zone' },
    error: { type: 'text' },
    metadata: { type: 'jsonb' }
  });

  // Create indexes for alerts
  pgm.createIndex('alerts', 'rule_id');
  pgm.createIndex('alerts', 'event_id');
  pgm.createIndex('alerts', 'status');
  pgm.createIndex('alerts', 'first_attempt');
  pgm.createIndex('alerts', 'last_attempt');
  pgm.createIndex('alerts', 'delivered_at');
};

export const down: MigrationFn = async (pgm: MigrationBuilder): Promise<void> => {
  pgm.dropTable('alerts');
  pgm.dropTable('alert_rules');
}; 
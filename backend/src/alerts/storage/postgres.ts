import type { Pool } from 'pg';
import { Logger } from '../../utils/logger';
import { NotionAssistantError, ErrorCode, ErrorSeverity } from '../../errors/types';
import { AlertStatus } from '../types';
import type {
  Alert,
  AlertRule,
  AlertStorage
} from '../types';

export class PostgresAlertStorage implements AlertStorage {
  private readonly pool: Pool;
  private readonly logger: Logger;

  constructor(pool: Pool) {
    this.pool = pool;
    this.logger = new Logger('PostgresAlertStorage');
  }

  async saveRule(rule: AlertRule): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO alert_rules (
          id, name, description, enabled, event_types, severities,
          conditions, channels, rate_limit_ms, cooldown_ms, metadata,
          created, updated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          enabled = EXCLUDED.enabled,
          event_types = EXCLUDED.event_types,
          severities = EXCLUDED.severities,
          conditions = EXCLUDED.conditions,
          channels = EXCLUDED.channels,
          rate_limit_ms = EXCLUDED.rate_limit_ms,
          cooldown_ms = EXCLUDED.cooldown_ms,
          metadata = EXCLUDED.metadata,
          updated = EXCLUDED.updated`,
        [
          rule.id,
          rule.name,
          rule.description,
          rule.enabled,
          JSON.stringify(rule.eventTypes),
          JSON.stringify(rule.severities),
          JSON.stringify(rule.conditions),
          JSON.stringify(rule.channels),
          rule.rateLimitMs,
          rule.cooldownMs,
          rule.metadata ? JSON.stringify(rule.metadata) : '{}',
          rule.created,
          rule.updated
        ]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new NotionAssistantError(
        'Failed to save alert rule',
        ErrorCode.INTERNAL_ERROR,
        ErrorSeverity.ERROR,
        true,
        { errorMessage: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  async getRule(id: string): Promise<AlertRule | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM alert_rules WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        enabled: row.enabled,
        eventTypes: JSON.parse(row.event_types),
        severities: JSON.parse(row.severities),
        conditions: JSON.parse(row.conditions),
        channels: JSON.parse(row.channels),
        rateLimitMs: row.rate_limit_ms,
        cooldownMs: row.cooldown_ms,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        created: row.created,
        updated: row.updated
      };
    } catch (error) {
      throw new NotionAssistantError(
        'Failed to get alert rule',
        ErrorCode.INTERNAL_ERROR,
        ErrorSeverity.ERROR,
        true,
        { errorMessage: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async getRules(filter?: Partial<AlertRule>): Promise<AlertRule[]> {
    try {
      let query = 'SELECT * FROM alert_rules';
      const params: unknown[] = [];
      const conditions: string[] = [];

      if (filter) {
        let paramIndex = 1;
        if (filter.enabled !== undefined) {
          conditions.push(`enabled = $${paramIndex}`);
          params.push(filter.enabled);
          paramIndex++;
        }
        if (filter.eventTypes?.length) {
          conditions.push(`event_types @> $${paramIndex}::jsonb`);
          params.push(JSON.stringify(filter.eventTypes));
          paramIndex++;
        }
        if (filter.severities?.length) {
          conditions.push(`severities @> $${paramIndex}::jsonb`);
          params.push(JSON.stringify(filter.severities));
          paramIndex++;
        }
      }

      if (conditions.length) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      const result = await this.pool.query(query, params);

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        enabled: row.enabled,
        eventTypes: JSON.parse(row.event_types),
        severities: JSON.parse(row.severities),
        conditions: JSON.parse(row.conditions),
        channels: JSON.parse(row.channels),
        rateLimitMs: row.rate_limit_ms,
        cooldownMs: row.cooldown_ms,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        created: row.created,
        updated: row.updated
      }));
    } catch (error) {
      throw new NotionAssistantError(
        'Failed to get alert rules',
        ErrorCode.INTERNAL_ERROR,
        ErrorSeverity.ERROR,
        true,
        { errorMessage: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async deleteRule(id: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM alert_rules WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new NotionAssistantError(
        'Failed to delete alert rule',
        ErrorCode.INTERNAL_ERROR,
        ErrorSeverity.ERROR,
        true,
        { errorMessage: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  async saveAlert(alert: Alert): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO alerts (
          id, rule_id, event_id, status, channels, attempts,
          first_attempt, last_attempt, delivered_at, error, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          attempts = EXCLUDED.attempts,
          last_attempt = EXCLUDED.last_attempt,
          delivered_at = EXCLUDED.delivered_at,
          error = EXCLUDED.error,
          metadata = EXCLUDED.metadata`,
        [
          alert.id,
          alert.ruleId,
          alert.eventId,
          alert.status,
          JSON.stringify(alert.channels),
          alert.attempts,
          alert.firstAttempt,
          alert.lastAttempt,
          alert.deliveredAt,
          alert.error,
          alert.metadata ? JSON.stringify(alert.metadata) : '{}'
        ]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new NotionAssistantError(
        'Failed to save alert',
        ErrorCode.INTERNAL_ERROR,
        ErrorSeverity.ERROR,
        true,
        { errorMessage: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  async getAlert(id: string): Promise<Alert | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM alerts WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        ruleId: row.rule_id,
        eventId: row.event_id,
        status: row.status as AlertStatus,
        channels: JSON.parse(row.channels),
        attempts: row.attempts,
        firstAttempt: row.first_attempt,
        lastAttempt: row.last_attempt,
        deliveredAt: row.delivered_at,
        error: row.error,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      };
    } catch (error) {
      throw new NotionAssistantError(
        'Failed to get alert',
        ErrorCode.INTERNAL_ERROR,
        ErrorSeverity.ERROR,
        true,
        { errorMessage: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async getAlerts(filter?: Partial<Alert>): Promise<Alert[]> {
    try {
      let query = 'SELECT * FROM alerts';
      const params: unknown[] = [];
      const conditions: string[] = [];

      if (filter) {
        let paramIndex = 1;
        if (filter.ruleId) {
          conditions.push(`rule_id = $${paramIndex}`);
          params.push(filter.ruleId);
          paramIndex++;
        }
        if (filter.status) {
          conditions.push(`status = $${paramIndex}`);
          params.push(filter.status);
          paramIndex++;
        }
        if (filter.eventId) {
          conditions.push(`event_id = $${paramIndex}`);
          params.push(filter.eventId);
          paramIndex++;
        }
      }

      if (conditions.length) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      query += ' ORDER BY first_attempt DESC';

      const result = await this.pool.query(query, params);

      return result.rows.map(row => ({
        id: row.id,
        ruleId: row.rule_id,
        eventId: row.event_id,
        status: row.status as AlertStatus,
        channels: JSON.parse(row.channels),
        attempts: row.attempts,
        firstAttempt: row.first_attempt,
        lastAttempt: row.last_attempt,
        deliveredAt: row.delivered_at,
        error: row.error,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined
      }));
    } catch (error) {
      throw new NotionAssistantError(
        'Failed to get alerts',
        ErrorCode.INTERNAL_ERROR,
        ErrorSeverity.ERROR,
        true,
        { errorMessage: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async updateAlertStatus(
    id: string,
    status: AlertStatus,
    error?: string
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const updates: string[] = ['status = $2'];
      const params: unknown[] = [id, status];
      let paramIndex = 3;

      if (error !== undefined) {
        updates.push(`error = $${paramIndex}`);
        params.push(error);
        paramIndex++;
      }

      if (status === AlertStatus.DELIVERED) {
        updates.push('delivered_at = NOW()');
      }

      updates.push('last_attempt = NOW()');
      updates.push('attempts = attempts + 1');

      await client.query(
        `UPDATE alerts SET ${updates.join(', ')} WHERE id = $1`,
        params
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new NotionAssistantError(
        'Failed to update alert status',
        ErrorCode.INTERNAL_ERROR,
        ErrorSeverity.ERROR,
        true,
        { errorMessage: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }
} 
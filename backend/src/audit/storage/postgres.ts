import type { Pool } from 'pg';
import { Logger } from '../../utils/logger';
import { NotionAssistantError, ErrorCode, ErrorSeverity } from '../../errors/types';
import type { AuditEvent, AuditEventQuery, AuditStorage } from '../types';

export class PostgresAuditStorage implements AuditStorage {
  private readonly pool: Pool;
  private readonly logger: Logger;

  constructor(pool: Pool) {
    this.pool = pool;
    this.logger = new Logger('PostgresAuditStorage');
  }

  async saveEvent(event: AuditEvent): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO audit_events (
          id, type, severity, timestamp, message, metadata,
          correlation_id, parent_event_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          event.id,
          event.type,
          event.severity,
          event.timestamp,
          event.message,
          JSON.stringify(event.metadata),
          event.correlationId,
          event.parentEventId
        ]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new NotionAssistantError(
        'Failed to save audit event',
        ErrorCode.INTERNAL_ERROR,
        ErrorSeverity.ERROR,
        true,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }

  async getEvents(query: AuditEventQuery): Promise<AuditEvent[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (query.startTime) {
      conditions.push(`timestamp >= $${paramIndex}`);
      params.push(query.startTime);
      paramIndex++;
    }

    if (query.endTime) {
      conditions.push(`timestamp <= $${paramIndex}`);
      params.push(query.endTime);
      paramIndex++;
    }

    if (query.types?.length) {
      conditions.push(`type = ANY($${paramIndex})`);
      params.push(query.types);
      paramIndex++;
    }

    if (query.severities?.length) {
      conditions.push(`severity = ANY($${paramIndex})`);
      params.push(query.severities);
      paramIndex++;
    }

    if (query.userId) {
      conditions.push(`metadata->>'userId' = $${paramIndex}`);
      params.push(query.userId);
      paramIndex++;
    }

    if (query.taskId) {
      conditions.push(`metadata->>'taskId' = $${paramIndex}`);
      params.push(query.taskId);
      paramIndex++;
    }

    if (query.resourceId) {
      conditions.push(`metadata->>'resourceId' = $${paramIndex}`);
      params.push(query.resourceId);
      paramIndex++;
    }

    if (query.correlationId) {
      conditions.push(`correlation_id = $${paramIndex}`);
      params.push(query.correlationId);
      paramIndex++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const orderClause = query.orderBy 
      ? `ORDER BY ${query.orderBy} ${query.orderDirection || 'desc'}`
      : 'ORDER BY timestamp desc';
    const limitClause = query.limit ? `LIMIT ${query.limit}` : '';
    const offsetClause = query.offset ? `OFFSET ${query.offset}` : '';

    try {
      const result = await this.pool.query(
        `SELECT * FROM audit_events 
         ${whereClause} 
         ${orderClause} 
         ${limitClause} 
         ${offsetClause}`,
        params
      );

      return result.rows.map(row => ({
        id: row.id,
        type: row.type,
        severity: row.severity,
        timestamp: row.timestamp,
        message: row.message,
        metadata: row.metadata,
        correlationId: row.correlation_id,
        parentEventId: row.parent_event_id
      }));
    } catch (error) {
      throw new NotionAssistantError(
        'Failed to retrieve audit events',
        ErrorCode.INTERNAL_ERROR,
        ErrorSeverity.ERROR,
        true,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async getEventById(id: string): Promise<AuditEvent | null> {
    try {
      const result = await this.pool.query(
        'SELECT * FROM audit_events WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        type: row.type,
        severity: row.severity,
        timestamp: row.timestamp,
        message: row.message,
        metadata: row.metadata,
        correlationId: row.correlation_id,
        parentEventId: row.parent_event_id
      };
    } catch (error) {
      throw new NotionAssistantError(
        'Failed to retrieve audit event',
        ErrorCode.INTERNAL_ERROR,
        ErrorSeverity.ERROR,
        true,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async deleteEvents(query: AuditEventQuery): Promise<number> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (query.startTime) {
        conditions.push(`timestamp >= $${paramIndex}`);
        params.push(query.startTime);
        paramIndex++;
      }

      if (query.endTime) {
        conditions.push(`timestamp <= $${paramIndex}`);
        params.push(query.endTime);
        paramIndex++;
      }

      if (query.types?.length) {
        conditions.push(`type = ANY($${paramIndex})`);
        params.push(query.types);
        paramIndex++;
      }

      if (query.severities?.length) {
        conditions.push(`severity = ANY($${paramIndex})`);
        params.push(query.severities);
        paramIndex++;
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await client.query(
        `DELETE FROM audit_events ${whereClause} RETURNING id`,
        params
      );

      await client.query('COMMIT');
      return result.rowCount ?? 0;
    } catch (error) {
      await client.query('ROLLBACK');
      throw new NotionAssistantError(
        'Failed to delete audit events',
        ErrorCode.INTERNAL_ERROR,
        ErrorSeverity.ERROR,
        true,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      client.release();
    }
  }
} 
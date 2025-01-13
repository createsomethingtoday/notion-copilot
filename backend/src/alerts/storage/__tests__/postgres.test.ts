import type { Pool, QueryResult, FieldDef, QueryResultRow } from 'pg';
import { PostgresAlertStorage } from '../postgres';
import { AlertStatus, AlertChannel } from '../../types';
import { AuditEventType, AuditEventSeverity } from '../../../audit/types';
import type { Alert, AlertRule, AlertCondition, AlertChannelConfig, WebhookConfig } from '../../types';
import { NotionAssistantError } from '../../../errors/types';

jest.mock('pg');

interface MockClient {
  query: jest.Mock<Promise<QueryResult<QueryResultRow>>>;
  release: jest.Mock;
}

interface MockQueryResult<T extends QueryResultRow = QueryResultRow> extends QueryResult<T> {
  command: string;
  oid: number;
  fields: FieldDef[];
}

describe('PostgresAlertStorage', () => {
  let pool: jest.Mocked<Pool>;
  let storage: PostgresAlertStorage;
  let mockClient: MockClient;

  const createMockQueryResult = <T extends QueryResultRow = QueryResultRow>(rows: T[] = [], rowCount = 0): MockQueryResult<T> => ({
    rows,
    rowCount,
    command: 'SELECT',
    oid: 0,
    fields: []
  });

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      query: jest.fn(),
    } as unknown as jest.Mocked<Pool>;
    storage = new PostgresAlertStorage(pool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('saveRule', () => {
    const webhookConfig: WebhookConfig = {
      url: 'https://example.com',
      method: 'POST'
    };

    const channelConfig: AlertChannelConfig = {
      type: AlertChannel.WEBHOOK,
      config: webhookConfig,
      enabled: true
    };

    const condition: AlertCondition = {
      type: 'threshold',
      field: 'severity',
      operator: 'eq',
      value: 'error'
    };

    const mockRule: AlertRule = {
      id: '123',
      name: 'Test Rule',
      description: 'Test Description',
      enabled: true,
      eventTypes: [AuditEventType.SYSTEM_STARTUP],
      severities: [AuditEventSeverity.ERROR],
      conditions: [condition],
      channels: [channelConfig],
      rateLimitMs: 1000,
      cooldownMs: 5000,
      metadata: { key: 'value' },
      created: new Date(),
      updated: new Date()
    };

    it('should save alert rule successfully', async () => {
      mockClient.query.mockResolvedValueOnce(createMockQueryResult());
      mockClient.query.mockResolvedValueOnce(createMockQueryResult());

      await storage.saveRule(mockRule);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO alert_rules'), expect.any(Array));
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback and throw error on failure', async () => {
      const error = new Error('Database error');
      mockClient.query.mockRejectedValueOnce(error);

      await expect(storage.saveRule(mockRule)).rejects.toThrow(NotionAssistantError);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getRule', () => {
    const webhookConfig: WebhookConfig = {
      url: 'https://example.com',
      method: 'POST'
    };

    const channelConfig: AlertChannelConfig = {
      type: AlertChannel.WEBHOOK,
      config: webhookConfig,
      enabled: true
    };

    const condition: AlertCondition = {
      type: 'threshold',
      field: 'severity',
      operator: 'eq',
      value: 'error'
    };

    interface AlertRuleRow extends QueryResultRow {
      id: string;
      name: string;
      description: string;
      enabled: boolean;
      event_types: string;
      severities: string;
      conditions: string;
      channels: string;
      rate_limit_ms: number;
      cooldown_ms: number;
      metadata: string;
      created: Date;
      updated: Date;
    }

    const mockRow: AlertRuleRow = {
      id: '123',
      name: 'Test Rule',
      description: 'Test Description',
      enabled: true,
      event_types: JSON.stringify([AuditEventType.SYSTEM_STARTUP]),
      severities: JSON.stringify([AuditEventSeverity.ERROR]),
      conditions: JSON.stringify([condition]),
      channels: JSON.stringify([channelConfig]),
      rate_limit_ms: 1000,
      cooldown_ms: 5000,
      metadata: JSON.stringify({ key: 'value' }),
      created: new Date(),
      updated: new Date()
    };

    it('should return rule when found', async () => {
      const mockResult = createMockQueryResult<AlertRuleRow>([mockRow]);
      (pool.query as jest.Mock).mockResolvedValueOnce(mockResult);

      const result = await storage.getRule('123');

      expect(result).toEqual({
        id: '123',
        name: 'Test Rule',
        description: 'Test Description',
        enabled: true,
        eventTypes: [AuditEventType.SYSTEM_STARTUP],
        severities: [AuditEventSeverity.ERROR],
        conditions: [condition],
        channels: [channelConfig],
        rateLimitMs: 1000,
        cooldownMs: 5000,
        metadata: { key: 'value' },
        created: mockRow.created,
        updated: mockRow.updated
      });
    });

    it('should return null when rule not found', async () => {
      const mockResult = createMockQueryResult<AlertRuleRow>();
      (pool.query as jest.Mock).mockResolvedValueOnce(mockResult);

      const result = await storage.getRule('123');

      expect(result).toBeNull();
    });
  });

  describe('updateAlertStatus', () => {
    const mockAlert = {
      id: '123',
      status: AlertStatus.PENDING
    };

    it('should update alert status successfully', async () => {
      mockClient.query.mockResolvedValueOnce(createMockQueryResult());
      mockClient.query.mockResolvedValueOnce(createMockQueryResult());

      await storage.updateAlertStatus(mockAlert.id, AlertStatus.DELIVERED);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE alerts'), expect.any(Array));
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should include error message when provided', async () => {
      mockClient.query.mockResolvedValueOnce(createMockQueryResult());
      mockClient.query.mockResolvedValueOnce(createMockQueryResult());

      const error = 'Failed to deliver alert';
      await storage.updateAlertStatus(mockAlert.id, AlertStatus.FAILED, error);

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE alerts'), expect.arrayContaining([mockAlert.id, AlertStatus.FAILED, error]));
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback and throw error on failure', async () => {
      const error = new Error('Database error');
      mockClient.query.mockRejectedValueOnce(error);

      await expect(storage.updateAlertStatus(mockAlert.id, AlertStatus.DELIVERED)).rejects.toThrow(NotionAssistantError);
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
}); 
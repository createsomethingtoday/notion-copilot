import type { AlertStorage } from '../types';
import { AlertStatus, AlertChannel, AlertService } from '..';
import { AuditEventType, AuditEventSeverity } from '../../audit/types';
import type { Alert, AlertRule, AlertCondition, AlertChannelConfig, WebhookConfig } from '../types';
import { NotionAssistantError } from '../../errors/types';
import type { Logger } from '../../utils/logger';

jest.mock('../../utils/logger');

describe('AlertService', () => {
  let service: AlertService;
  let mockStorage: jest.Mocked<AlertStorage>;
  let mockLogger: jest.Mocked<Logger>;

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

  const mockAlert: Alert = {
    id: '456',
    ruleId: mockRule.id,
    eventId: '789',
    status: AlertStatus.PENDING,
    channels: [AlertChannel.WEBHOOK],
    attempts: 0,
    firstAttempt: new Date(),
    metadata: { key: 'value' }
  };

  beforeEach(() => {
    mockStorage = {
      saveRule: jest.fn(),
      getRule: jest.fn(),
      getRules: jest.fn(),
      deleteRule: jest.fn(),
      saveAlert: jest.fn(),
      getAlert: jest.fn(),
      getAlerts: jest.fn(),
      updateAlertStatus: jest.fn()
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as unknown as jest.Mocked<Logger>;

    service = new AlertService({
      storage: mockStorage,
      logger: mockLogger,
      retryDelayMs: 1000,
      maxRetries: 3,
      batchSize: 10,
      flushIntervalMs: 5000
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createRule', () => {
    it('should create a new alert rule', async () => {
      await service.createRule(mockRule);

      expect(mockStorage.saveRule).toHaveBeenCalledWith(mockRule);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Created alert rule'),
        expect.objectContaining({ ruleId: mockRule.id })
      );
    });

    it('should throw error if rule creation fails', async () => {
      const error = new Error('Storage error');
      mockStorage.saveRule.mockRejectedValueOnce(error);

      await expect(service.createRule(mockRule)).rejects.toThrow(NotionAssistantError);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create alert rule'),
        expect.objectContaining({ errorMessage: error.message })
      );
    });
  });

  describe('processEvent', () => {
    it('should create alerts for matching rules', async () => {
      mockStorage.getRules.mockResolvedValueOnce([mockRule]);
      mockStorage.saveAlert.mockResolvedValueOnce();

      await service.processEvent({
        id: '789',
        type: AuditEventType.SYSTEM_STARTUP,
        severity: AuditEventSeverity.ERROR,
        timestamp: new Date(),
        message: 'System startup',
        metadata: {}
      });

      expect(mockStorage.getRules).toHaveBeenCalledWith({ enabled: true });
      expect(mockStorage.saveAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleId: mockRule.id,
          eventId: '789',
          status: AlertStatus.PENDING
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Created alert'),
        expect.any(Object)
      );
    });

    it('should not create alerts for non-matching rules', async () => {
      const nonMatchingRule: AlertRule = {
        ...mockRule,
        eventTypes: [AuditEventType.SYSTEM_SHUTDOWN]
      };
      mockStorage.getRules.mockResolvedValueOnce([nonMatchingRule]);

      await service.processEvent({
        id: '789',
        type: AuditEventType.SYSTEM_STARTUP,
        severity: AuditEventSeverity.ERROR,
        timestamp: new Date(),
        message: 'System startup',
        metadata: {}
      });

      expect(mockStorage.getRules).toHaveBeenCalledWith({ enabled: true });
      expect(mockStorage.saveAlert).not.toHaveBeenCalled();
    });
  });

  describe('deliverAlert', () => {
    it('should deliver alert successfully', async () => {
      mockStorage.getAlert.mockResolvedValueOnce(mockAlert);
      mockStorage.getRule.mockResolvedValueOnce(mockRule);

      await service.deliverAlert(mockAlert.id);

      expect(mockStorage.updateAlertStatus).toHaveBeenCalledWith(
        mockAlert.id,
        AlertStatus.DELIVERED
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Alert delivered'),
        expect.objectContaining({ alertId: mockAlert.id })
      );
    });

    it('should handle delivery failure and retry', async () => {
      const error = new Error('Delivery failed');
      mockStorage.getAlert.mockResolvedValueOnce(mockAlert);
      mockStorage.getRule.mockResolvedValueOnce(mockRule);
      mockStorage.updateAlertStatus.mockRejectedValueOnce(error);

      await service.deliverAlert(mockAlert.id);

      expect(mockStorage.updateAlertStatus).toHaveBeenCalledWith(
        mockAlert.id,
        AlertStatus.FAILED,
        error.message
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to deliver alert'),
        expect.objectContaining({
          alertId: mockAlert.id,
          errorMessage: error.message
        })
      );
    });

    it('should handle rate limiting', async () => {
      const rateLimitedAlert: Alert = {
        ...mockAlert,
        attempts: 5
      };
      mockStorage.getAlert.mockResolvedValueOnce(rateLimitedAlert);
      mockStorage.getRule.mockResolvedValueOnce(mockRule);

      await service.deliverAlert(rateLimitedAlert.id);

      expect(mockStorage.updateAlertStatus).toHaveBeenCalledWith(
        rateLimitedAlert.id,
        AlertStatus.RATE_LIMITED
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Alert rate limited'),
        expect.objectContaining({ alertId: rateLimitedAlert.id })
      );
    });
  });

  describe('shutdown', () => {
    it('should flush pending alerts and stop processing', async () => {
      const pendingAlerts: Alert[] = [mockAlert];
      mockStorage.getAlerts.mockResolvedValueOnce(pendingAlerts);

      await service.shutdown();

      expect(mockStorage.getAlerts).toHaveBeenCalledWith({
        status: AlertStatus.PENDING
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Alert service shutting down'),
        expect.any(Object)
      );
    });
  });
}); 
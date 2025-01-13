import { WebhookChannel } from '..';
import { AlertChannel, AlertStatus } from '../../types';
import type { Alert, AlertRule, WebhookConfig } from '../../types';
import { NotionAssistantError } from '../../../errors/types';
import type { Logger } from '../../../utils/logger';
import { AuditEventType, AuditEventSeverity } from '../../../audit/types';

jest.mock('../../../utils/logger');

describe('WebhookChannel', () => {
  let channel: WebhookChannel;
  let mockLogger: jest.Mocked<Logger>;
  let mockFetch: jest.Mock;

  const webhookConfig: Required<WebhookConfig> = {
    url: 'https://example.com/webhook',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'test-key'
    },
    retryConfig: {
      maxRetries: 3,
      backoffMs: 1000
    }
  };

  const mockRule: AlertRule = {
    id: '123',
    name: 'Test Rule',
    description: 'Test Description',
    enabled: true,
    eventTypes: [AuditEventType.SYSTEM_STARTUP],
    severities: [AuditEventSeverity.ERROR],
    conditions: [{
      type: 'threshold',
      field: 'severity',
      operator: 'eq',
      value: 'error'
    }],
    channels: [{
      type: AlertChannel.WEBHOOK,
      config: webhookConfig,
      enabled: true
    }],
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
    metadata: {
      eventType: AuditEventType.SYSTEM_STARTUP,
      eventSeverity: AuditEventSeverity.ERROR,
      key: 'value'
    }
  };

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as unknown as jest.Mocked<Logger>;

    mockFetch = jest.fn();
    global.fetch = mockFetch;

    channel = new WebhookChannel({
      logger: mockLogger
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('deliver', () => {
    it('should deliver alert successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK'
      });

      await channel.deliver(mockAlert, mockRule);

      expect(mockFetch).toHaveBeenCalledWith(
        webhookConfig.url,
        expect.objectContaining({
          method: webhookConfig.method,
          headers: webhookConfig.headers,
          body: expect.any(String)
        })
      );

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody).toEqual(expect.objectContaining({
        alertId: mockAlert.id,
        ruleId: mockRule.id,
        eventId: mockAlert.eventId,
        eventType: mockAlert.metadata?.eventType,
        eventSeverity: mockAlert.metadata?.eventSeverity
      }));

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Webhook delivered'),
        expect.objectContaining({
          alertId: mockAlert.id,
          url: webhookConfig.url
        })
      );
    });

    it('should retry on temporary failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK'
        });

      await channel.deliver(mockAlert, mockRule);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Webhook delivery failed, retrying'),
        expect.objectContaining({
          alertId: mockAlert.id,
          url: webhookConfig.url,
          attempt: 1,
          errorMessage: 'Network error'
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Webhook delivered'),
        expect.objectContaining({
          alertId: mockAlert.id,
          url: webhookConfig.url
        })
      );
    });

    it('should handle permanent failure', async () => {
      const error = new Error('Invalid webhook URL');
      mockFetch.mockRejectedValue(error);

      await expect(channel.deliver(mockAlert, mockRule)).rejects.toThrow(NotionAssistantError);

      expect(mockFetch).toHaveBeenCalledTimes(webhookConfig.retryConfig.maxRetries);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Webhook delivery failed permanently'),
        expect.objectContaining({
          alertId: mockAlert.id,
          url: webhookConfig.url,
          attempts: webhookConfig.retryConfig.maxRetries,
          errorMessage: error.message
        })
      );
    });

    it('should handle non-200 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(channel.deliver(mockAlert, mockRule)).rejects.toThrow(NotionAssistantError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Webhook delivery failed'),
        expect.objectContaining({
          alertId: mockAlert.id,
          url: webhookConfig.url,
          status: 404,
          statusText: 'Not Found'
        })
      );
    });

    it('should validate webhook configuration', async () => {
      const invalidRule: AlertRule = {
        ...mockRule,
        channels: [{
          type: AlertChannel.WEBHOOK,
          config: {
            ...webhookConfig,
            url: 'invalid-url'
          },
          enabled: true
        }]
      };

      await expect(channel.deliver(mockAlert, invalidRule)).rejects.toThrow(NotionAssistantError);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid webhook configuration'),
        expect.objectContaining({
          alertId: mockAlert.id,
          ruleId: invalidRule.id,
          error: expect.any(String)
        })
      );
    });
  });
}); 
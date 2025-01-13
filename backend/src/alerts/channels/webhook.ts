import type { Logger } from '../../utils/logger';
import { NotionAssistantError, ErrorCode, ErrorSeverity } from '../../errors/types';
import type { Alert, AlertRule, WebhookConfig } from '../types';
import { AlertChannel } from '../types';

export interface WebhookChannelOptions {
  logger: Logger;
}

export class WebhookChannel {
  private readonly logger: Logger;

  constructor(options: WebhookChannelOptions) {
    this.logger = options.logger;
  }

  async deliver(alert: Alert, rule: AlertRule): Promise<void> {
    const webhookConfig = this.getWebhookConfig(rule);
    if (!webhookConfig) {
      throw new NotionAssistantError(
        'Invalid webhook configuration',
        ErrorCode.INVALID_CONFIGURATION,
        ErrorSeverity.ERROR,
        true,
        {
          alertId: alert.id,
          ruleId: rule.id,
          error: 'No webhook configuration found'
        }
      );
    }

    const { url, method, headers, retryConfig } = webhookConfig;
    const maxRetries = retryConfig?.maxRetries ?? 3;
    const backoffMs = retryConfig?.backoffMs ?? 1000;

    let lastError: Error | null = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: JSON.stringify({
            alertId: alert.id,
            ruleId: rule.id,
            eventId: alert.eventId,
            eventType: alert.metadata?.eventType,
            eventSeverity: alert.metadata?.eventSeverity,
            timestamp: new Date().toISOString(),
            metadata: alert.metadata
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        this.logger.info('Webhook delivered', {
          alertId: alert.id,
          url,
          attempt: attempt + 1
        });
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries - 1) {
          this.logger.warn('Webhook delivery failed, retrying', {
            alertId: alert.id,
            url,
            attempt: attempt + 1,
            errorMessage: lastError.message
          });
          await new Promise(resolve => setTimeout(resolve, backoffMs * (2 ** attempt)));
        }
      }
    }

    this.logger.error('Webhook delivery failed permanently', {
      alertId: alert.id,
      url,
      attempts: maxRetries,
      errorMessage: lastError?.message
    });

    throw new NotionAssistantError(
      'Webhook delivery failed',
      ErrorCode.DELIVERY_FAILED,
      ErrorSeverity.ERROR,
      true,
      {
        alertId: alert.id,
        ruleId: rule.id,
        url,
        attempts: maxRetries,
        errorMessage: lastError?.message
      }
    );
  }

  private getWebhookConfig(rule: AlertRule): WebhookConfig | null {
    const webhookChannel = rule.channels.find(
      channel => channel.type === AlertChannel.WEBHOOK && channel.enabled
    );

    if (!webhookChannel) {
      return null;
    }

    const config = webhookChannel.config;
    if (this.isWebhookConfig(config)) {
      return config;
    }

    return null;
  }

  private isWebhookConfig(config: unknown): config is WebhookConfig {
    if (!config || typeof config !== 'object') {
      return false;
    }

    const { url, method } = config as WebhookConfig;
    return (
      typeof url === 'string' &&
      url.length > 0 &&
      (method === 'POST' || method === 'PUT')
    );
  }
} 
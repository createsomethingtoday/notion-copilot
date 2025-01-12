import type { 
  NotionAssistantError,
  ErrorSeverity,
  ErrorCategory 
} from '../errors/types';

/**
 * Metric types for monitoring
 */
export enum MetricType {
  COUNTER = 'counter',    // Monotonically increasing value
  GAUGE = 'gauge',        // Value that can go up and down
  HISTOGRAM = 'histogram' // Statistical distribution of values
}

/**
 * Metric categories for better organization
 */
export enum MetricCategory {
  ERROR = 'error',           // Error-related metrics
  PERFORMANCE = 'performance', // Performance metrics
  RESOURCE = 'resource',      // Resource utilization
  TASK = 'task',             // Task execution metrics
  API = 'api',               // API-related metrics
  USER = 'user'              // User-related metrics
}

/**
 * Base metric interface
 */
export interface Metric {
  name: string;
  type: MetricType;
  category: MetricCategory;
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

/**
 * Error metric with additional context
 */
export interface ErrorMetric extends Metric {
  category: MetricCategory.ERROR;
  error: NotionAssistantError;
  severity: ErrorSeverity;
  errorCategory: ErrorCategory;
}

/**
 * Performance metric for timing operations
 */
export interface PerformanceMetric extends Metric {
  category: MetricCategory.PERFORMANCE;
  operation: string;
  duration: number;
  success: boolean;
}

/**
 * Resource utilization metric
 */
export interface ResourceMetric extends Metric {
  category: MetricCategory.RESOURCE;
  resource: string;
  limit?: number;
  usage: number;
}

/**
 * Task execution metric
 */
export interface TaskMetric extends Metric {
  category: MetricCategory.TASK;
  taskType: string;
  duration: number;
  success: boolean;
  retries?: number;
}

/**
 * API metric for tracking API usage
 */
export interface APIMetric extends Metric {
  category: MetricCategory.API;
  endpoint: string;
  method: string;
  statusCode: number;
  duration: number;
}

/**
 * User activity metric
 */
export interface UserMetric extends Metric {
  category: MetricCategory.USER;
  userId: string;
  action: string;
  success: boolean;
}

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  name: string;
  description: string;
  severity: AlertSeverity;
  condition: {
    metric: string;
    operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
    threshold: number;
    duration?: number; // Duration in seconds the condition must be true
  };
  labels?: Record<string, string>;
  channels?: string[]; // Notification channels
}

/**
 * Alert instance
 */
export interface Alert {
  config: AlertConfig;
  triggered: Date;
  value: number;
  resolved?: Date;
}

/**
 * Monitoring provider configuration
 */
export interface MonitoringConfig {
  provider: 'datadog' | 'newrelic' | 'prometheus' | 'cloudwatch';
  apiKey?: string;
  endpoint?: string;
  tags?: Record<string, string>;
  alertConfigs?: AlertConfig[];
  flushIntervalMs?: number;
  batchSize?: number;
  retryConfig?: {
    maxRetries: number;
    backoffMs: number;
  };
  // System metrics configuration
  systemMetricsInterval?: number;
  enableGCMetrics?: boolean;
}

/**
 * Represents a single metric data point
 */
export interface MetricValue {
  name: string;
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

/**
 * Interface for metric providers (e.g. Datadog, Prometheus)
 */
export interface MetricProvider {
  sendMetrics(metrics: MetricValue[]): Promise<void>;
  destroy?(): void;
}

export interface MetricDefinition {
  name: string;
  help: string;
  type: MetricType;
  labels?: string[];
}

export interface MetricOptions {
  labels?: Record<string, string>;
  timestamp?: number;
} 
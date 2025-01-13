export interface MetricValue {
  name: string;
  value: number;
  type: 'gauge' | 'counter' | 'histogram';
  timestamp: number;
  tags?: Record<string, string>;
}

export interface MetricProvider {
  sendMetrics(metrics: MetricValue[]): Promise<void>;
  reset?(): Promise<void>;
  destroy?(): void;
} 
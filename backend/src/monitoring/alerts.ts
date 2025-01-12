import type { AlertConfig } from './types';
import { AlertSeverity } from './types';

export const systemAlertConfigs: AlertConfig[] = [
  // Memory alerts
  {
    name: 'high_memory_usage',
    description: 'Memory usage is approaching system limits',
    severity: AlertSeverity.WARNING,
    condition: {
      metric: 'system_memory_usage',
      operator: '>',
      threshold: 0.85, // 85% of total memory
      duration: 300 // Alert if condition persists for 5 minutes
    },
    labels: {
      type: 'heap'
    }
  },
  {
    name: 'critical_memory_usage',
    description: 'Memory usage has reached critical levels',
    severity: AlertSeverity.CRITICAL,
    condition: {
      metric: 'system_memory_usage',
      operator: '>',
      threshold: 0.95, // 95% of total memory
      duration: 60 // Alert if condition persists for 1 minute
    },
    labels: {
      type: 'heap'
    }
  },

  // CPU alerts
  {
    name: 'high_cpu_usage',
    description: 'CPU usage is high',
    severity: AlertSeverity.WARNING,
    condition: {
      metric: 'system_cpu_usage',
      operator: '>',
      threshold: 80, // 80% CPU usage
      duration: 300 // Alert if condition persists for 5 minutes
    },
    labels: {
      type: 'process'
    }
  },
  {
    name: 'critical_cpu_usage',
    description: 'CPU usage is critically high',
    severity: AlertSeverity.CRITICAL,
    condition: {
      metric: 'system_cpu_usage',
      operator: '>',
      threshold: 95, // 95% CPU usage
      duration: 60 // Alert if condition persists for 1 minute
    },
    labels: {
      type: 'process'
    }
  },

  // Event loop alerts
  {
    name: 'high_event_loop_lag',
    description: 'Event loop lag is high',
    severity: AlertSeverity.WARNING,
    condition: {
      metric: 'system_event_loop_lag',
      operator: '>',
      threshold: 100, // 100ms lag
      duration: 60 // Alert if condition persists for 1 minute
    }
  },
  {
    name: 'critical_event_loop_lag',
    description: 'Event loop lag is critically high',
    severity: AlertSeverity.CRITICAL,
    condition: {
      metric: 'system_event_loop_lag',
      operator: '>',
      threshold: 1000, // 1s lag
      duration: 30 // Alert if condition persists for 30 seconds
    }
  },

  // GC alerts
  {
    name: 'frequent_gc',
    description: 'Garbage collection is occurring frequently',
    severity: AlertSeverity.WARNING,
    condition: {
      metric: 'system_gc_duration',
      operator: '>',
      threshold: 100, // More than 100ms per GC
      duration: 300 // Alert if condition persists for 5 minutes
    }
  },

  // Handle alerts
  {
    name: 'high_handle_count',
    description: 'High number of active handles',
    severity: AlertSeverity.WARNING,
    condition: {
      metric: 'system_active_handles',
      operator: '>',
      threshold: 1000, // More than 1000 handles
      duration: 300 // Alert if condition persists for 5 minutes
    }
  }
];

// Export function to get alert configs
export function getSystemAlertConfigs(): AlertConfig[] {
  return systemAlertConfigs;
} 
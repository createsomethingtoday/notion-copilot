import { systemAlertConfigs } from '../alerts';
import { AlertSeverity } from '../types';

describe('System Alert Configurations', () => {
  describe('memory alerts', () => {
    const memoryAlerts = systemAlertConfigs.filter(
      alert => alert.condition.metric === 'system_memory_usage'
    );

    it('should have warning and critical thresholds', () => {
      expect(memoryAlerts).toHaveLength(2);

      const warning = memoryAlerts.find(
        alert => alert.severity === AlertSeverity.WARNING
      );
      const critical = memoryAlerts.find(
        alert => alert.severity === AlertSeverity.CRITICAL
      );

      expect(warning).toBeDefined();
      expect(critical).toBeDefined();

      expect(warning?.condition.threshold).toBeLessThan(
        critical?.condition.threshold ?? 1
      );
    });

    it('should have appropriate durations', () => {
      const warning = memoryAlerts.find(
        alert => alert.severity === AlertSeverity.WARNING
      );
      const critical = memoryAlerts.find(
        alert => alert.severity === AlertSeverity.CRITICAL
      );

      // Warning should have longer duration than critical
      expect(warning?.condition.duration).toBeGreaterThan(
        critical?.condition.duration ?? 0
      );
    });
  });

  describe('CPU alerts', () => {
    const cpuAlerts = systemAlertConfigs.filter(
      alert => alert.condition.metric === 'system_cpu_usage'
    );

    it('should have warning and critical thresholds', () => {
      expect(cpuAlerts).toHaveLength(2);

      const warning = cpuAlerts.find(
        alert => alert.severity === AlertSeverity.WARNING
      );
      const critical = cpuAlerts.find(
        alert => alert.severity === AlertSeverity.CRITICAL
      );

      expect(warning).toBeDefined();
      expect(critical).toBeDefined();

      expect(warning?.condition.threshold).toBeLessThan(
        critical?.condition.threshold ?? 100
      );
    });

    it('should have appropriate durations', () => {
      const warning = cpuAlerts.find(
        alert => alert.severity === AlertSeverity.WARNING
      );
      const critical = cpuAlerts.find(
        alert => alert.severity === AlertSeverity.CRITICAL
      );

      // Warning should have longer duration than critical
      expect(warning?.condition.duration).toBeGreaterThan(
        critical?.condition.duration ?? 0
      );
    });
  });

  describe('event loop alerts', () => {
    const lagAlerts = systemAlertConfigs.filter(
      alert => alert.condition.metric === 'system_event_loop_lag'
    );

    it('should have warning and critical thresholds', () => {
      expect(lagAlerts).toHaveLength(2);

      const warning = lagAlerts.find(
        alert => alert.severity === AlertSeverity.WARNING
      );
      const critical = lagAlerts.find(
        alert => alert.severity === AlertSeverity.CRITICAL
      );

      expect(warning).toBeDefined();
      expect(critical).toBeDefined();

      expect(warning?.condition.threshold).toBeLessThan(
        critical?.condition.threshold ?? 1000
      );
    });

    it('should have appropriate durations', () => {
      const warning = lagAlerts.find(
        alert => alert.severity === AlertSeverity.WARNING
      );
      const critical = lagAlerts.find(
        alert => alert.severity === AlertSeverity.CRITICAL
      );

      // Warning should have longer duration than critical
      expect(warning?.condition.duration).toBeGreaterThan(
        critical?.condition.duration ?? 0
      );
    });
  });

  describe('GC alerts', () => {
    const gcAlerts = systemAlertConfigs.filter(
      alert => alert.condition.metric === 'system_gc_duration'
    );

    it('should have warning threshold', () => {
      expect(gcAlerts).toHaveLength(1);
      expect(gcAlerts[0].severity).toBe(AlertSeverity.WARNING);
      expect(gcAlerts[0].condition.threshold).toBeGreaterThan(0);
    });
  });

  describe('handle alerts', () => {
    const handleAlerts = systemAlertConfigs.filter(
      alert => alert.condition.metric === 'system_active_handles'
    );

    it('should have warning threshold', () => {
      expect(handleAlerts).toHaveLength(1);
      expect(handleAlerts[0].severity).toBe(AlertSeverity.WARNING);
      expect(handleAlerts[0].condition.threshold).toBeGreaterThan(0);
    });
  });

  describe('alert configuration validity', () => {
    it('should have valid durations', () => {
      for (const alert of systemAlertConfigs) {
        if (alert.condition.duration !== undefined) {
          expect(alert.condition.duration).toBeGreaterThan(0);
        }
      }
    });

    it('should have valid thresholds', () => {
      for (const alert of systemAlertConfigs) {
        expect(alert.condition.threshold).toBeGreaterThan(0);
      }
    });

    it('should have unique names', () => {
      const names = systemAlertConfigs.map(alert => alert.name);
      const uniqueNames = new Set(names);
      expect(names.length).toBe(uniqueNames.size);
    });

    it('should have descriptions', () => {
      for (const alert of systemAlertConfigs) {
        expect(alert.description).toBeTruthy();
      }
    });
  });
}); 
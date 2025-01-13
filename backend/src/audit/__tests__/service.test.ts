import { AuditService } from '../service';
import { AuditEventType, AuditEventSeverity } from '../types';
import type { AuditEvent, AuditStorage } from '../types';

describe('AuditService', () => {
  let mockStorage: jest.Mocked<AuditStorage>;
  let auditService: AuditService;

  beforeEach(() => {
    mockStorage = {
      saveEvent: jest.fn(),
      getEvents: jest.fn(),
      getEventById: jest.fn(),
      deleteEvents: jest.fn()
    };

    auditService = new AuditService({
      storage: mockStorage,
      retentionDays: 7,
      batchSize: 2,
      flushIntervalMs: 100
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('createEvent', () => {
    it('should create and queue an event', async () => {
      const eventId = await auditService.createEvent(
        AuditEventType.TASK_CREATED,
        'Task created',
        { taskId: '123' }
      );

      expect(eventId).toBeDefined();
      expect(mockStorage.saveEvent).not.toHaveBeenCalled();
    });

    it('should save event immediately when immediate flag is set', async () => {
      const eventId = await auditService.createEvent(
        AuditEventType.TASK_CREATED,
        'Task created',
        { taskId: '123' },
        { immediate: true }
      );

      expect(eventId).toBeDefined();
      expect(mockStorage.saveEvent).toHaveBeenCalledTimes(1);
      expect(mockStorage.saveEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: AuditEventType.TASK_CREATED,
          message: 'Task created',
          metadata: { taskId: '123' }
        })
      );
    });
  });

  describe('batch processing', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should flush events when batch size is reached', async () => {
      await auditService.createEvent(AuditEventType.TASK_CREATED, 'Task 1');
      await auditService.createEvent(AuditEventType.TASK_CREATED, 'Task 2');

      expect(mockStorage.saveEvent).toHaveBeenCalledTimes(2);
    });

    it('should flush events after interval', async () => {
      await auditService.createEvent(AuditEventType.TASK_CREATED, 'Task 1');
      
      jest.advanceTimersByTime(100);
      
      expect(mockStorage.saveEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe('queryEvents', () => {
    it('should query events with filters', async () => {
      const mockEvents: AuditEvent[] = [
        {
          id: '1',
          type: AuditEventType.TASK_CREATED,
          severity: AuditEventSeverity.INFO,
          timestamp: new Date(),
          message: 'Task created',
          metadata: { taskId: '123' }
        }
      ];

      mockStorage.getEvents.mockResolvedValue(mockEvents);

      const events = await auditService.queryEvents({
        types: [AuditEventType.TASK_CREATED],
        severities: [AuditEventSeverity.INFO]
      });

      expect(events).toEqual(mockEvents);
      expect(mockStorage.getEvents).toHaveBeenCalledWith({
        types: [AuditEventType.TASK_CREATED],
        severities: [AuditEventSeverity.INFO]
      });
    });
  });

  describe('getEventById', () => {
    it('should retrieve event by ID', async () => {
      const mockEvent: AuditEvent = {
        id: '1',
        type: AuditEventType.TASK_CREATED,
        severity: AuditEventSeverity.INFO,
        timestamp: new Date(),
        message: 'Task created',
        metadata: { taskId: '123' }
      };

      mockStorage.getEventById.mockResolvedValue(mockEvent);

      const event = await auditService.getEventById('1');

      expect(event).toEqual(mockEvent);
      expect(mockStorage.getEventById).toHaveBeenCalledWith('1');
    });

    it('should return null for non-existent event', async () => {
      mockStorage.getEventById.mockResolvedValue(null);

      const event = await auditService.getEventById('non-existent');

      expect(event).toBeNull();
    });
  });

  describe('cleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should schedule cleanup job', () => {
      const now = new Date('2024-03-19T00:00:00Z');
      jest.setSystemTime(now);

      const midnight = new Date('2024-03-20T00:00:00Z');
      const msUntilMidnight = midnight.getTime() - now.getTime();

      jest.advanceTimersByTime(msUntilMidnight);

      expect(mockStorage.deleteEvents).toHaveBeenCalledWith(
        expect.objectContaining({
          endTime: expect.any(Date)
        })
      );
    });
  });

  describe('shutdown', () => {
    it('should flush remaining events', async () => {
      await auditService.createEvent(AuditEventType.TASK_CREATED, 'Task 1');
      await auditService.shutdown();

      expect(mockStorage.saveEvent).toHaveBeenCalledTimes(1);
    });
  });
}); 
import { Logger } from '../logger';
import { ErrorSeverity } from '../types';
import { FileLogger } from '../file-logger';

jest.mock('../file-logger');

describe('Logger', () => {
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleInfo: jest.SpyInstance;
  let mockConsoleWarn: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;
  let mockFileLogger: jest.Mocked<FileLogger>;
  let logger: Logger;

  beforeEach(() => {
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
    mockConsoleInfo = jest.spyOn(console, 'info').mockImplementation();
    mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
    mockFileLogger = new FileLogger({ path: 'test.log', maxSize: 1024, maxFiles: 2 }) as jest.Mocked<FileLogger>;
    logger = new Logger({ console: true });
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleInfo.mockRestore();
    mockConsoleWarn.mockRestore();
    mockConsoleError.mockRestore();
    jest.clearAllMocks();
  });

  describe('logging methods', () => {
    it('should log debug messages to console', () => {
      const context = { source: 'test' };
      logger.debug('test message', context);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG]'),
        context
      );
    });

    it('should log info messages to console', () => {
      const context = { source: 'test' };
      logger.info('test message', context);
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        context
      );
    });

    it('should log warn messages to console', () => {
      const error = new Error('Test error');
      const context = { source: 'test' };
      logger.warn('test message', error, context);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining('[WARN]'),
        { ...context, error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }}
      );
    });

    it('should log error messages to console', () => {
      const error = new Error('Test error');
      const context = { source: 'test' };
      logger.error('test message', error, context);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR]'),
        { ...context, error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }}
      );
    });
  });

  describe('console logging', () => {
    it('should not log to console when disabled', () => {
      logger = new Logger({ console: false });
      logger.info('Test message');

      expect(mockConsoleInfo).not.toHaveBeenCalled();
    });

    it('should respect minimum log level', () => {
      logger = new Logger({ minLevel: ErrorSeverity.INFO });
      logger.debug('Test debug message');

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });
  });

  describe('file logging', () => {
    it('should initialize file logger with options', () => {
      expect(FileLogger).toHaveBeenCalledWith({
        path: 'test.log',
        maxSize: 10 * 1024 * 1024,
        maxFiles: 5
      });
    });

    it('should not initialize file logger when path is not provided', () => {
      jest.clearAllMocks();
      logger = new Logger({ console: true });
      expect(FileLogger).not.toHaveBeenCalled();
    });
  });
}); 
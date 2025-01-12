import { Logger } from '../logger';
import { ErrorSeverity } from '../types';
import { FileLogger } from '../file-logger';

jest.mock('../file-logger');

describe('Logger', () => {
  let logger: Logger;
  let mockConsoleDebug: jest.SpyInstance;
  let mockConsoleInfo: jest.SpyInstance;
  let mockConsoleWarn: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;
  let mockFileLogger: jest.Mocked<FileLogger>;

  beforeEach(() => {
    mockConsoleDebug = jest.spyOn(console, 'debug').mockImplementation();
    mockConsoleInfo = jest.spyOn(console, 'info').mockImplementation();
    mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
    
    mockFileLogger = new FileLogger({
      path: 'test.log',
      maxSize: 10 * 1024 * 1024,
      maxFiles: 5
    }) as jest.Mocked<FileLogger>;
    (FileLogger as jest.Mock).mockImplementation(() => mockFileLogger);

    logger = new Logger({
      console: true,
      file: {
        path: 'test.log',
        maxSize: 10 * 1024 * 1024,
        maxFiles: 5
      }
    });
  });

  afterEach(() => {
    mockConsoleDebug.mockRestore();
    mockConsoleInfo.mockRestore();
    mockConsoleWarn.mockRestore();
    mockConsoleError.mockRestore();
    jest.clearAllMocks();
  });

  describe('logging methods', () => {
    it('should log debug messages', () => {
      const message = 'Test debug message';
      logger.debug(message);

      expect(mockConsoleDebug).toHaveBeenCalled();
      const consoleMessage = mockConsoleDebug.mock.calls[0][0];
      expect(consoleMessage).toContain(message);
      expect(consoleMessage).toContain('DEBUG');
    });

    it('should log info messages', () => {
      const message = 'Test info message';
      logger.info(message);

      expect(mockConsoleInfo).toHaveBeenCalled();
      const consoleMessage = mockConsoleInfo.mock.calls[0][0];
      expect(consoleMessage).toContain(message);
      expect(consoleMessage).toContain('INFO');
    });

    it('should log warning messages with context', () => {
      const message = 'Test warning message';
      const context = { source: 'test' };
      logger.warn(message, undefined, context);

      expect(mockConsoleWarn).toHaveBeenCalled();
      const consoleMessage = mockConsoleWarn.mock.calls[0][0];
      expect(consoleMessage).toContain(message);
      expect(consoleMessage).toContain('WARNING');
      expect(mockConsoleWarn.mock.calls[0][1]).toEqual(context);
    });

    it('should log error messages with error object', () => {
      const message = 'Test error message';
      const error = new Error('Test error');
      logger.error(message, error);

      expect(mockConsoleError).toHaveBeenCalled();
      const consoleMessage = mockConsoleError.mock.calls[0][0];
      expect(consoleMessage).toContain(message);
      expect(consoleMessage).toContain('ERROR');
      expect(mockConsoleError.mock.calls[0][1]).toHaveProperty('error');
    });
  });

  describe('console logging', () => {
    it('should not log to console when disabled', () => {
      logger = new Logger({ console: false });
      logger.info('Test message');

      expect(mockConsoleInfo).not.toHaveBeenCalled();
    });

    it('should respect minimum log level', () => {
      logger = new Logger({ 
        console: true,
        minLevel: ErrorSeverity.ERROR
      });

      logger.info('Should not log');
      logger.error('Should log', new Error('Test'));

      expect(mockConsoleInfo).not.toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalled();
      expect(mockConsoleError.mock.calls[0][0]).toContain('Should log');
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
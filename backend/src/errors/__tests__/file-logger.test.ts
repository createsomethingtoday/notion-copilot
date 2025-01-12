import { FileLogger } from '../file-logger';
import { ErrorSeverity } from '../types';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

jest.mock('node:fs/promises');
jest.mock('node:path');

describe('FileLogger', () => {
  let fileLogger: FileLogger;
  const testPath = '/test/logs/app.log';
  
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fs.readdir as jest.Mock).mockResolvedValue([]);
    (path.dirname as jest.Mock).mockReturnValue('/test/logs');
    
    fileLogger = new FileLogger({
      path: testPath,
      maxSize: 10 * 1024 * 1024,
      maxFiles: 5
    });
  });

  describe('initialize', () => {
    it('should create log directory if it does not exist', async () => {
      await fileLogger.initialize();
      
      expect(path.dirname).toHaveBeenCalledWith(testPath);
      expect(fs.mkdir).toHaveBeenCalledWith('/test/logs', { recursive: true });
    });

    it('should handle existing directory', async () => {
      (fs.mkdir as jest.Mock).mockRejectedValue({ code: 'EEXIST' });
      
      await expect(fileLogger.initialize()).resolves.not.toThrow();
    });
  });

  describe('write', () => {
    beforeEach(async () => {
      await fileLogger.initialize();
    });

    it('should write log entries to file', async () => {
      const entries = [{
        timestamp: new Date('2024-01-01'),
        level: ErrorSeverity.INFO,
        message: 'Test message'
      }];

      await fileLogger.write(entries);

      expect(fs.writeFile).toHaveBeenCalledWith(
        testPath,
        expect.stringContaining('Test message'),
        { flag: 'a' }
      );
    });

    it('should rotate files when size limit is reached', async () => {
      (fs.stat as jest.Mock).mockResolvedValue({ size: 11 * 1024 * 1024 });
      (fs.readdir as jest.Mock).mockResolvedValue(['app.log', 'app.1.log']);
      
      const entries = [{
        timestamp: new Date('2024-01-01'),
        level: ErrorSeverity.INFO,
        message: 'Test message'
      }];

      await fileLogger.write(entries);

      expect(fs.rename).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(
        testPath,
        expect.stringContaining('Test message'),
        { flag: 'w' }
      );
    });

    it('should handle write errors', async () => {
      (fs.writeFile as jest.Mock).mockRejectedValue(new Error('Write failed'));
      
      const entries = [{
        timestamp: new Date('2024-01-01'),
        level: ErrorSeverity.INFO,
        message: 'Test message'
      }];

      await expect(fileLogger.write(entries)).rejects.toThrow('Write failed');
    });
  });
}); 
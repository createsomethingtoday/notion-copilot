import { ErrorHandler } from '../handler';
import { NotionAssistantError, ErrorSeverity, ErrorCategory, ErrorCode } from '../types';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
  });

  describe('handleError', () => {
    it('should normalize and handle standard errors', async () => {
      const error = new Error('Test error');
      
      await expect(errorHandler.handleError(error)).rejects.toThrow(NotionAssistantError);
    });

    it('should handle NotionAssistantError directly', async () => {
      const error = new NotionAssistantError(
        'Custom error',
        ErrorCode.TASK_VALIDATION_FAILED,
        ErrorSeverity.WARNING,
        true
      );

      await expect(errorHandler.handleError(error)).rejects.toThrow(error);
    });

    it('should handle Notion API errors', async () => {
      const error = new Error('Notion API error');
      error.name = 'NotionClientError';
      
      await expect(errorHandler.handleError(error)).rejects.toThrow(NotionAssistantError);
    });
  });

  describe('wrap', () => {
    it('should wrap a function with error handling', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Test error'));
      const wrapped = errorHandler.wrap(mockFn);

      await expect(wrapped()).rejects.toThrow(NotionAssistantError);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should pass through successful results', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const wrapped = errorHandler.wrap(mockFn);

      const result = await wrapped();
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
}); 
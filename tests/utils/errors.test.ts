/**
 * Tests for error handling utilities
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  MCPError,
  SecurityError,
  DatabaseError,
  ValidationError,
  NotFoundError,
  ConfigurationError,
  getSafeErrorMessage,
  createErrorResponse,
  withErrorHandling
} from '../../src/utils/errors';

describe('Error Handling Utilities', () => {
  describe('Custom Error Classes', () => {
    it('SecurityError should have correct properties', () => {
      const error = new SecurityError('Path traversal detected', 'PATH_TRAVERSAL');
      expect(error).toBeInstanceOf(MCPError);
      expect(error).toBeInstanceOf(SecurityError);
      expect(error.code).toBe('SECURITY_ERROR');
      expect(error.userMessage).toBe('Security validation failed');
      expect(error.securityCode).toBe('PATH_TRAVERSAL');
      expect(error.message).toBe('Path traversal detected');
    });

    it('DatabaseError should have correct properties', () => {
      const error = new DatabaseError('Connection failed', 'connect');
      expect(error).toBeInstanceOf(MCPError);
      expect(error).toBeInstanceOf(DatabaseError);
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.userMessage).toBe('Database operation failed');
      expect(error.operation).toBe('connect');
      expect(error.message).toBe('Connection failed');
    });

    it('ValidationError should have correct properties', () => {
      const error1 = new ValidationError('Invalid input');
      expect(error1.code).toBe('VALIDATION_ERROR');
      expect(error1.userMessage).toBe('Invalid input provided');
      
      const error2 = new ValidationError('Invalid input', 'Custom user message');
      expect(error2.userMessage).toBe('Custom user message');
    });

    it('NotFoundError should have correct properties', () => {
      const error = new NotFoundError('Project', 'my-app');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.userMessage).toBe("Project 'my-app' not found");
      expect(error.message).toBe('Project not found: my-app');
    });

    it('ConfigurationError should have correct properties', () => {
      const error = new ConfigurationError('Missing API key');
      expect(error.code).toBe('CONFIG_ERROR');
      expect(error.userMessage).toBe('Configuration error');
      expect(error.message).toBe('Missing API key');
    });
  });

  describe('getSafeErrorMessage', () => {
    it('should return user message for MCPError instances', () => {
      const error = new ValidationError('Internal details', 'Safe message');
      expect(getSafeErrorMessage(error)).toBe('Safe message');
    });

    it('should handle TypeError', () => {
      const error = new TypeError('Cannot read property of undefined');
      expect(getSafeErrorMessage(error)).toBe('Invalid operation attempted');
    });

    it('should handle RangeError', () => {
      const error = new RangeError('Array size exceeded');
      expect(getSafeErrorMessage(error)).toBe('Value out of acceptable range');
    });

    it('should provide generic message for unknown errors', () => {
      expect(getSafeErrorMessage(new Error('Unknown'))).toBe('An unexpected error occurred');
      expect(getSafeErrorMessage('string error')).toBe('An unexpected error occurred');
      expect(getSafeErrorMessage(null)).toBe('An unexpected error occurred');
      expect(getSafeErrorMessage(undefined)).toBe('An unexpected error occurred');
    });
  });

  describe('createErrorResponse', () => {
    it('should create response for MCPError', () => {
      const error = new DatabaseError('Connection lost', 'query');
      const response = createErrorResponse(error);
      expect(response).toEqual({
        error: 'Database operation failed',
        code: 'DATABASE_ERROR'
      });
    });

    it('should create response for generic errors', () => {
      const response = createErrorResponse(new Error('Something went wrong'));
      expect(response).toEqual({
        error: 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR'
      });
    });

    it('should handle non-Error objects', () => {
      const response = createErrorResponse('string error');
      expect(response).toEqual({
        error: 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR'
      });
    });
  });

  describe('withErrorHandling', () => {
    it('should pass through successful results', async () => {
      const handler = jest.fn().mockResolvedValue('success' as any);
      const wrapped = withErrorHandling(handler as any);
      
      const result = await wrapped('arg1', 'arg2');
      expect(result).toBe('success');
      expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should catch and format errors', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const handler = jest.fn().mockRejectedValue(new ValidationError('Bad input', 'Invalid data') as any);
      const wrapped = withErrorHandling(handler as any);
      
      await expect(wrapped('arg')).rejects.toEqual({
        error: 'Invalid data',
        code: 'VALIDATION_ERROR'
      });
      
      expect(consoleError).toHaveBeenCalledWith('Handler error:', expect.any(ValidationError));
      consoleError.mockRestore();
    });

    it('should handle non-Error rejections', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      const handler = jest.fn().mockRejectedValue('string rejection' as any);
      const wrapped = withErrorHandling(handler as any);
      
      await expect(wrapped()).rejects.toEqual({
        error: 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR'
      });
      
      expect(consoleError).toHaveBeenCalledWith('Handler error:', 'string rejection');
      consoleError.mockRestore();
    });

    it('should preserve function signature', () => {
      const handler = async (a: string, b: number): Promise<boolean> => {
        return a.length > b;
      };
      
      const wrapped = withErrorHandling(handler);
      // TypeScript should allow this without errors
      expect(typeof wrapped).toBe('function');
    });
  });
});

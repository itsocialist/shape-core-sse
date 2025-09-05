/**
 * Error handling utilities for MCP Context Memory
 * Provides safe error messages and categorization
 */

/**
 * Base error class for MCP Context Memory
 */
export abstract class MCPError extends Error {
  abstract readonly code: string;
  abstract readonly userMessage: string;
  
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Security-related errors
 */
export class SecurityError extends MCPError {
  readonly code = 'SECURITY_ERROR';
  readonly userMessage = 'Security validation failed';
  
  constructor(message: string, public securityCode: string) {
    super(message);
  }
}

/**
 * Database-related errors
 */
export class DatabaseError extends MCPError {
  readonly code = 'DATABASE_ERROR';
  readonly userMessage = 'Database operation failed';
  
  constructor(message: string, public operation?: string) {
    super(message);
  }
}

/**
 * Validation errors for user input
 */
export class ValidationError extends MCPError {
  readonly code = 'VALIDATION_ERROR';
  readonly userMessage: string;
  
  constructor(message: string, userMessage?: string) {
    super(message);
    this.userMessage = userMessage || 'Invalid input provided';
  }
}

/**
 * Not found errors
 */
export class NotFoundError extends MCPError {
  readonly code = 'NOT_FOUND';
  readonly userMessage: string;
  
  constructor(resource: string, identifier: string) {
    super(`${resource} not found: ${identifier}`);
    this.userMessage = `${resource} '${identifier}' not found`;
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends MCPError {
  readonly code = 'CONFIG_ERROR';
  readonly userMessage = 'Configuration error';
  
  constructor(message: string) {
    super(message);
  }
}

/**
 * Converts any error to a safe user-facing message
 * @param error The error to handle
 * @returns Safe error message for users
 */
export function getSafeErrorMessage(error: unknown): string {
  // Handle our custom errors
  if (error instanceof MCPError) {
    return error.userMessage;
  }
  
  // Handle specific known error types
  if (error instanceof TypeError) {
    return 'Invalid operation attempted';
  }
  
  if (error instanceof RangeError) {
    return 'Value out of acceptable range';
  }
  
  // Generic fallback
  return 'An unexpected error occurred';
}

/**
 * Error response format for MCP tools
 */
export interface ErrorResponse {
  error: string;
  code?: string;
}

/**
 * Creates a standardized error response
 * @param error The error to format
 * @returns Formatted error response
 */
export function createErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof MCPError) {
    return {
      error: error.userMessage,
      code: error.code
    };
  }
  
  return {
    error: getSafeErrorMessage(error),
    code: 'UNKNOWN_ERROR'
  };
}

/**
 * Wraps an async handler with error handling
 * @param handler The async handler to wrap
 * @returns Wrapped handler that catches and formats errors
 */
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>
): (...args: T) => Promise<R | ErrorResponse> {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (error) {
      // Log the actual error for debugging (when logging is implemented)
      console.error('Handler error:', error);
      
      // Return safe error response
      throw createErrorResponse(error);
    }
  };
}


/**
 * Common error codes
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SECURITY_ERROR: 'SECURITY_ERROR',
  CONFIG_ERROR: 'CONFIG_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

/**
 * Generic application error for flexibility
 */
export class ApplicationError extends MCPError {
  readonly code: string;
  readonly userMessage: string;
  
  constructor(message: string, code: string = ERROR_CODES.VALIDATION_ERROR) {
    super(message);
    this.code = code;
    this.userMessage = message;
  }
}

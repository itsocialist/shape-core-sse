/**
 * Security utilities for MCP Context Memory
 * Handles validation and sanitization of user inputs
 */

import { resolve, normalize, isAbsolute } from 'path';
import { homedir } from 'os';

/**
 * Custom error class for security-related errors
 */
export class SecurityError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Validates and sanitizes file system paths to prevent directory traversal
 * @param inputPath The path to validate
 * @param allowedBasePaths Optional array of allowed base paths
 * @returns The normalized, absolute path
 * @throws SecurityError if path is invalid or outside allowed directories
 */
export function validatePath(
  inputPath: string | undefined | null,
  allowedBasePaths?: string[]
): string | null {
  // Handle empty paths
  if (!inputPath) {
    return null;
  }

  // Normalize and resolve the path to prevent traversal attacks
  const normalizedPath = normalize(inputPath);
  
  // Expand home directory if present
  const expandedPath = normalizedPath.startsWith('~') 
    ? normalizedPath.replace(/^~/, homedir())
    : normalizedPath;
  
  // Get absolute path
  const absolutePath = isAbsolute(expandedPath) 
    ? expandedPath 
    : resolve(expandedPath);

  // Check for null bytes which can be used for path injection
  if (absolutePath.includes('\0')) {
    throw new SecurityError(
      'Path contains null bytes',
      'NULL_BYTE_INJECTION'
    );
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.\.[\/\\]\.\./, // Multiple traversals
    /[<>"|?*]/, // Invalid characters on Windows
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(absolutePath)) {
      throw new SecurityError(
        'Path contains suspicious patterns',
        'SUSPICIOUS_PATH_PATTERN'
      );
    }
  }

  // If allowed base paths are specified, ensure the path is within them
  if (allowedBasePaths && allowedBasePaths.length > 0) {
    const isAllowed = allowedBasePaths.some(basePath => {
      const normalizedBase = resolve(basePath);
      return absolutePath.startsWith(normalizedBase);
    });

    if (!isAllowed) {
      throw new SecurityError(
        'Path is outside allowed directories',
        'PATH_TRAVERSAL_ATTEMPT'
      );
    }
  }

  return absolutePath;
}

/**
 * Validates repository URLs to ensure they're safe
 * @param url The repository URL to validate
 * @returns The validated URL or null
 * @throws SecurityError if URL is invalid
 */
export function validateRepositoryUrl(
  url: string | undefined | null
): string | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    
    // Only allow specific protocols
    const allowedProtocols = ['https:', 'http:', 'git:', 'ssh:'];
    if (!allowedProtocols.includes(parsed.protocol)) {
      throw new SecurityError(
        'Invalid repository protocol',
        'INVALID_PROTOCOL'
      );
    }

    // Check for suspicious patterns in the URL
    if (url.includes('\0') || url.includes('..')) {
      throw new SecurityError(
        'Repository URL contains suspicious patterns',
        'SUSPICIOUS_URL_PATTERN'
      );
    }

    return url;
  } catch (error) {
    if (error instanceof SecurityError) {
      throw error;
    }
    throw new SecurityError(
      'Invalid repository URL format',
      'INVALID_URL_FORMAT'
    );
  }
}

/**
 * Validates JSON data before parsing
 * @param data The JSON string to validate
 * @param maxLength Maximum allowed length
 * @returns Parsed JSON object
 * @throws SecurityError if JSON is invalid or too large
 */
export function safeJsonParse<T = any>(
  data: string,
  maxLength: number = 1048576 // 1MB default
): T {
  // Check size to prevent DoS
  if (data.length > maxLength) {
    throw new SecurityError(
      `JSON data exceeds maximum length of ${maxLength} bytes`,
      'JSON_TOO_LARGE'
    );
  }

  try {
    return JSON.parse(data);
  } catch (error) {
    throw new SecurityError(
      'Invalid JSON format',
      'INVALID_JSON'
    );
  }
}

/**
 * Safely stringify JSON with size limits
 * @param data The object to stringify
 * @param maxLength Maximum allowed length
 * @returns JSON string
 * @throws SecurityError if resulting string is too large
 */
export function safeJsonStringify(
  data: any,
  maxLength: number = 1048576 // 1MB default
): string {
  try {
    const result = JSON.stringify(data);
    
    if (result.length > maxLength) {
      throw new SecurityError(
        `JSON output exceeds maximum length of ${maxLength} bytes`,
        'JSON_OUTPUT_TOO_LARGE'
      );
    }
    
    return result;
  } catch (error) {
    if (error instanceof SecurityError) {
      throw error;
    }
    throw new SecurityError(
      'Failed to stringify JSON',
      'JSON_STRINGIFY_ERROR'
    );
  }
}


/**
 * Sanitize user input to prevent injection attacks
 * @param input The input string to sanitize
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length to prevent DoS
  const maxLength = 65535;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Get current system ID helper (re-exported from db/helpers)
 */
export { getCurrentSystemId } from '../db/helpers.js';

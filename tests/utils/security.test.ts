/**
 * Tests for security utilities
 */

import { describe, it, expect } from '@jest/globals';
import { 
  validatePath, 
  validateRepositoryUrl, 
  safeJsonParse, 
  safeJsonStringify,
  SecurityError 
} from '../../src/utils/security';
import { homedir } from 'os';
import { resolve } from 'path';

describe('Security Utilities', () => {
  describe('validatePath', () => {
    it('should accept valid absolute paths', () => {
      const validPath = '/Users/test/projects/my-app';
      const result = validatePath(validPath);
      expect(result).toBe(validPath);
    });

    it('should expand home directory', () => {
      const pathWithHome = '~/projects/my-app';
      const result = validatePath(pathWithHome);
      expect(result).toBe(resolve(homedir(), 'projects/my-app'));
    });

    it('should normalize paths', () => {
      const unnormalizedPath = '/Users/test/../test/projects/./my-app';
      const result = validatePath(unnormalizedPath);
      expect(result).toBe('/Users/test/projects/my-app');
    });

    it('should reject paths with null bytes', () => {
      expect(() => validatePath('/test/path\0evil')).toThrow(SecurityError);
      expect(() => validatePath('/test/path\0evil')).toThrow('null bytes');
    });

    it('should reject paths with suspicious patterns', () => {
      expect(() => validatePath('/test/<script>alert(1)</script>')).toThrow(SecurityError);
      expect(() => validatePath('/test/file|name')).toThrow(SecurityError);
    });

    it('should handle empty paths', () => {
      expect(validatePath(null)).toBeNull();
      expect(validatePath(undefined)).toBeNull();
      expect(validatePath('')).toBeNull();
    });

    it('should enforce allowed base paths when provided', () => {
      const allowedPaths = ['/Users/test/projects'];
      expect(validatePath('/Users/test/projects/app', allowedPaths))
        .toBe('/Users/test/projects/app');
      
      expect(() => validatePath('/etc/passwd', allowedPaths))
        .toThrow('outside allowed directories');
    });
  });

  describe('validateRepositoryUrl', () => {
    it('should accept valid HTTPS URLs', () => {
      const url = 'https://github.com/user/repo';
      expect(validateRepositoryUrl(url)).toBe(url);
    });

    it('should accept valid HTTP URLs', () => {
      const url = 'http://gitlab.local/user/repo';
      expect(validateRepositoryUrl(url)).toBe(url);
    });

    it('should accept git protocol URLs', () => {
      const url = 'git://github.com/user/repo.git';
      expect(validateRepositoryUrl(url)).toBe(url);
    });

    it('should accept SSH URLs', () => {
      const url = 'ssh://git@github.com/user/repo.git';
      expect(validateRepositoryUrl(url)).toBe(url);
    });

    it('should reject invalid protocols', () => {
      expect(() => validateRepositoryUrl('file:///etc/passwd')).toThrow('Invalid repository protocol');
      expect(() => validateRepositoryUrl('javascript:alert(1)')).toThrow('Invalid repository protocol');
    });

    it('should reject URLs with null bytes', () => {
      expect(() => validateRepositoryUrl('https://github.com/user\0/repo')).toThrow('suspicious patterns');
    });

    it('should reject URLs with path traversal', () => {
      expect(() => validateRepositoryUrl('https://github.com/../etc/passwd')).toThrow('suspicious patterns');
    });

    it('should handle empty URLs', () => {
      expect(validateRepositoryUrl(null)).toBeNull();
      expect(validateRepositoryUrl(undefined)).toBeNull();
      expect(validateRepositoryUrl('')).toBeNull();
    });

    it('should reject malformed URLs', () => {
      expect(() => validateRepositoryUrl('not a url')).toThrow('Invalid repository URL format');
    });
  });

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const json = '{"test": "value", "number": 42}';
      const result = safeJsonParse(json);
      expect(result).toEqual({ test: 'value', number: 42 });
    });

    it('should reject JSON that exceeds size limit', () => {
      const largeJson = '{"data": "' + 'x'.repeat(2000000) + '"}';
      expect(() => safeJsonParse(largeJson)).toThrow('exceeds maximum length');
    });

    it('should reject invalid JSON', () => {
      expect(() => safeJsonParse('{')).toThrow('Invalid JSON format');
      expect(() => safeJsonParse('undefined')).toThrow('Invalid JSON format');
    });

    it('should respect custom size limits', () => {
      const json = '{"test": "value"}';
      expect(safeJsonParse(json, 100)).toEqual({ test: 'value' });
      expect(() => safeJsonParse(json, 10)).toThrow('exceeds maximum length');
    });
  });

  describe('safeJsonStringify', () => {
    it('should stringify valid objects', () => {
      const obj = { test: 'value', number: 42 };
      const result = safeJsonStringify(obj);
      expect(result).toBe('{"test":"value","number":42}');
    });

    it('should reject objects that stringify to large strings', () => {
      const largeObj = { data: 'x'.repeat(2000000) };
      expect(() => safeJsonStringify(largeObj)).toThrow('exceeds maximum length');
    });

    it('should handle circular references gracefully', () => {
      const obj: any = { a: 1 };
      obj.circular = obj;
      expect(() => safeJsonStringify(obj)).toThrow('Failed to stringify JSON');
    });

    it('should respect custom size limits', () => {
      const obj = { test: 'value' };
      expect(safeJsonStringify(obj, 100)).toBe('{"test":"value"}');
      expect(() => safeJsonStringify(obj, 10)).toThrow('exceeds maximum length');
    });
  });
});

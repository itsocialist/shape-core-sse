/**
 * Tests for JSON validation utilities
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateTags,
  validateMetadata,
  parseJsonTags,
  parseJsonMetadata,
  JSON_LIMITS
} from '../../src/utils/jsonValidation';

describe('JSON Validation Utilities', () => {
  describe('validateTags', () => {
    it('should accept valid tags array', () => {
      const tags = ['typescript', 'backend', 'api'];
      const result = validateTags(tags);
      expect(result).toEqual(tags);
    });

    it('should accept empty array', () => {
      const result = validateTags([]);
      expect(result).toEqual([]);
    });

    it('should reject empty tags', () => {
      expect(() => validateTags(['valid', ''])).toThrow('Tag cannot be empty');
    });

    it('should reject tags that are too long', () => {
      const longTag = 'x'.repeat(JSON_LIMITS.TAG_MAX_LENGTH + 1);
      expect(() => validateTags([longTag])).toThrow('exceeds maximum length');
    });

    it('should reject tags with invalid characters', () => {
      expect(() => validateTags(['valid-tag', 'invalid@tag#'])).toThrow('invalid characters');
    });

    it('should accept tags with allowed characters', () => {
      const validTags = ['under_score', 'with-dash', 'with.dot', 'with space'];
      const result = validateTags(validTags);
      expect(result).toEqual(validTags);
    });

    it('should reject too many tags', () => {
      const tooManyTags = Array(JSON_LIMITS.TAGS_MAX_COUNT + 1).fill('tag');
      expect(() => validateTags(tooManyTags)).toThrow(`Cannot have more than ${JSON_LIMITS.TAGS_MAX_COUNT} tags`);
    });

    it('should handle non-array input', () => {
      expect(() => validateTags('not an array')).toThrow();
      expect(() => validateTags(null)).toThrow();
    });
  });

  describe('validateMetadata', () => {
    it('should accept valid metadata object', () => {
      const metadata = {
        version: '1.0.0',
        author: 'test',
        count: 42,
        enabled: true,
        optional: null,
        tags: ['a', 'b']
      };
      const result = validateMetadata(metadata);
      expect(result).toEqual(metadata);
    });

    it('should accept empty object', () => {
      const result = validateMetadata({});
      expect(result).toEqual({});
    });

    it('should reject values that are too long', () => {
      const longValue = 'x'.repeat(JSON_LIMITS.VALUE_MAX_LENGTH + 1);
      expect(() => validateMetadata({ key: longValue })).toThrow();
    });

    it('should reject keys that are too long', () => {
      const longKey = 'x'.repeat(JSON_LIMITS.KEY_MAX_LENGTH + 1);
      const metadata = { [longKey]: 'value' };
      expect(() => validateMetadata(metadata)).toThrow('keys cannot exceed');
    });

    it('should reject too many keys', () => {
      const metadata: Record<string, string> = {};
      for (let i = 0; i <= JSON_LIMITS.METADATA_MAX_KEYS; i++) {
        metadata[`key${i}`] = 'value';
      }
      expect(() => validateMetadata(metadata)).toThrow(`cannot have more than ${JSON_LIMITS.METADATA_MAX_KEYS} keys`);
    });

    it('should reject metadata that serializes too large', () => {
      const metadata: Record<string, string> = {};
      // Create metadata that's within key/value limits but exceeds total size
      for (let i = 0; i < 50; i++) {
        metadata[`key${i}`] = 'x'.repeat(500);
      }
      expect(() => validateMetadata(metadata)).toThrow('size cannot exceed');
    });

    it('should reject invalid value types', () => {
      expect(() => validateMetadata({ func: () => {} })).toThrow();
      expect(() => validateMetadata({ date: new Date() })).toThrow();
    });

    it('should handle nested objects by rejecting them', () => {
      expect(() => validateMetadata({ nested: { object: 'value' } })).toThrow();
    });
  });

  describe('parseJsonTags', () => {
    it('should parse valid JSON tags', () => {
      const json = '["tag1", "tag2", "tag3"]';
      const result = parseJsonTags(json);
      expect(result).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should return empty array for invalid JSON', () => {
      const result = parseJsonTags('not json');
      expect(result).toEqual([]);
    });

    it('should return empty array for non-array JSON', () => {
      const result = parseJsonTags('{"not": "array"}');
      expect(result).toEqual([]);
    });

    it('should filter invalid tags from parsed JSON', () => {
      const json = '["valid", "", "also-valid"]';
      const result = parseJsonTags(json);
      expect(result).toEqual([]);  // All rejected due to empty tag
    });
  });

  describe('parseJsonMetadata', () => {
    it('should parse valid JSON metadata', () => {
      const json = '{"key": "value", "number": 42}';
      const result = parseJsonMetadata(json);
      expect(result).toEqual({ key: 'value', number: 42 });
    });

    it('should return empty object for invalid JSON', () => {
      const result = parseJsonMetadata('not json');
      expect(result).toEqual({});
    });

    it('should return empty object for non-object JSON', () => {
      const result = parseJsonMetadata('["not", "object"]');
      expect(result).toEqual({});
    });

    it('should return empty object if validation fails', () => {
      const json = '{"key": {"nested": "object"}}';
      const result = parseJsonMetadata(json);
      expect(result).toEqual({});
    });
  });
});

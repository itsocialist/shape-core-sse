/**
 * JSON validation schemas for MCP Context Memory
 * Validates JSON fields before storage
 */

import { z } from 'zod';
import { ValidationError } from './errors.js';

/**
 * Maximum sizes for JSON fields
 */
export const JSON_LIMITS = {
  TAGS_MAX_COUNT: 50,
  TAG_MAX_LENGTH: 100,
  METADATA_MAX_SIZE: 10240, // 10KB
  METADATA_MAX_KEYS: 100,
  KEY_MAX_LENGTH: 100,
  VALUE_MAX_LENGTH: 1024,
} as const;

/**
 * Schema for tags array
 */
export const tagsSchema = z.array(
  z.string()
    .min(1, 'Tag cannot be empty')
    .max(JSON_LIMITS.TAG_MAX_LENGTH, `Tag exceeds maximum length of ${JSON_LIMITS.TAG_MAX_LENGTH}`)
    .regex(/^[\w\-\.\s]+$/, 'Tag contains invalid characters')
).max(JSON_LIMITS.TAGS_MAX_COUNT, `Cannot have more than ${JSON_LIMITS.TAGS_MAX_COUNT} tags`)
.default([]);

/**
 * Schema for metadata object
 */
export const metadataSchema = z.object({})
  .catchall(
    z.union([
      z.string().max(JSON_LIMITS.VALUE_MAX_LENGTH),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(z.string().max(JSON_LIMITS.VALUE_MAX_LENGTH)),
    ])
  )
  .refine(
    (obj) => Object.keys(obj).length <= JSON_LIMITS.METADATA_MAX_KEYS,
    `Metadata cannot have more than ${JSON_LIMITS.METADATA_MAX_KEYS} keys`
  )
  .refine(
    (obj) => Object.keys(obj).every(key => key.length <= JSON_LIMITS.KEY_MAX_LENGTH),
    `Metadata keys cannot exceed ${JSON_LIMITS.KEY_MAX_LENGTH} characters`
  )
  .refine(
    (obj) => JSON.stringify(obj).length <= JSON_LIMITS.METADATA_MAX_SIZE,
    `Metadata size cannot exceed ${JSON_LIMITS.METADATA_MAX_SIZE} bytes`
  )
  .default({});

/**
 * Validates tags array
 * @param tags The tags to validate
 * @returns Validated tags array
 * @throws ValidationError if invalid
 */
export function validateTags(tags: unknown): string[] {
  try {
    return tagsSchema.parse(tags);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid tags: ${error.errors[0].message}`);
    }
    throw error;
  }
}

/**
 * Validates metadata object
 * @param metadata The metadata to validate
 * @returns Validated metadata object
 * @throws ValidationError if invalid
 */
export function validateMetadata(metadata: unknown): Record<string, any> {
  try {
    return metadataSchema.parse(metadata);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid metadata: ${error.errors[0].message}`);
    }
    throw error;
  }
}

/**
 * Safely parses and validates JSON tags
 * @param jsonString The JSON string to parse
 * @returns Validated tags array
 */
export function parseJsonTags(jsonString: string): string[] {
  try {
    const parsed = JSON.parse(jsonString);
    return validateTags(parsed);
  } catch (error) {
    // Return empty array on parse failure
    return [];
  }
}

/**
 * Safely parses and validates JSON metadata
 * @param jsonString The JSON string to parse
 * @returns Validated metadata object
 */
export function parseJsonMetadata(jsonString: string): Record<string, any> {
  try {
    const parsed = JSON.parse(jsonString);
    return validateMetadata(parsed);
  } catch (error) {
    // Return empty object on parse failure
    return {};
  }
}


/**
 * Validates JSON data is safe to store
 * @param data The data to validate
 * @throws ValidationError if data is invalid
 */
export function validateJSON(data: any): void {
  if (data === null || data === undefined) {
    return;
  }
  
  // Check for circular references
  try {
    JSON.stringify(data);
  } catch (error) {
    throw new ValidationError('JSON contains circular references');
  }
  
  // Validate size
  const jsonString = JSON.stringify(data);
  const maxSize = 1048576; // 1MB
  if (jsonString.length > maxSize) {
    throw new ValidationError('JSON data exceeds maximum size of 1MB');
  }
}

/**
 * Role Validator
 * Validates custom role configurations for security and correctness
 */

import { z } from 'zod';
import { ApplicationError, ERROR_CODES } from './errors.js';

// Valid context types from our system
const VALID_CONTEXT_TYPES = [
  'decision', 'code', 'standard', 'status', 
  'todo', 'note', 'config', 'issue', 'reference'
] as const;

// Role ID validation - alphanumeric, dash, underscore only
const roleIdSchema = z.string()
  .min(1)
  .max(50)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Role ID must be alphanumeric with dashes/underscores only');

// Safe string validation - no script tags or dangerous content
const safeStringSchema = z.string()
  .max(1000)
  .refine(
    (val) => !/<script|<iframe|javascript:|data:/i.test(val),
    'String contains potentially unsafe content'
  );

// Custom role configuration schema
export const customRoleSchema = z.object({
  id: roleIdSchema,
  name: z.string().min(1).max(100).refine(
    (val) => !/<script|<iframe|javascript:/i.test(val),
    'Name contains potentially unsafe content'
  ),
  description: safeStringSchema,
  base_role_id: z.string().optional(),
  focus_areas: z.array(z.string().max(50)).max(20),
  default_tags: z.array(z.string().max(30)).max(15),
  preferred_context_types: z.array(z.enum(VALID_CONTEXT_TYPES)).max(9)
});

export type CustomRoleConfig = z.infer<typeof customRoleSchema>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: CustomRoleConfig;
}

export class RoleValidator {
  // Reserved role IDs that can't be used for custom roles
  private static RESERVED_IDS = [
    'architect', 'developer', 'devops', 'qa', 'product',
    'admin', 'system', 'default', 'custom', 'template'
  ];

  /**
   * Validate a custom role configuration
   */
  static validateCustomRole(input: unknown): ValidationResult {
    try {
      // Parse with Zod schema
      const parsed = customRoleSchema.parse(input);
      
      // Additional validation
      if (this.RESERVED_IDS.includes(parsed.id.toLowerCase())) {
        return {
          valid: false,
          errors: [`Role ID '${parsed.id}' is reserved and cannot be used`]
        };
      }
      
      // Ensure unique values in arrays
      parsed.focus_areas = [...new Set(parsed.focus_areas)];
      parsed.default_tags = [...new Set(parsed.default_tags)];
      parsed.preferred_context_types = [...new Set(parsed.preferred_context_types)];
      
      // Sanitize strings
      parsed.name = this.sanitizeString(parsed.name);
      parsed.description = this.sanitizeString(parsed.description);
      parsed.focus_areas = parsed.focus_areas.map(s => this.sanitizeString(s));
      parsed.default_tags = parsed.default_tags.map(s => this.sanitizeString(s));
      
      return {
        valid: true,
        errors: [],
        sanitized: parsed
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return {
        valid: false,
        errors: ['Invalid role configuration']
      };
    }
  }

  /**
   * Validate a role template for import
   */
  static validateRoleTemplate(template: unknown): ValidationResult {
    // Templates have the same validation as custom roles
    // In the future, we might add additional template-specific validation
    return this.validateCustomRole(template);
  }

  /**
   * Sanitize a string for safe storage
   */
  private static sanitizeString(str: string): string {
    return str
      .trim()
      .replace(/[<>]/g, '') // Remove angle brackets
      .substring(0, 1000);  // Enforce max length
  }

  /**
   * Check if a role ID is available
   */
  static isRoleIdAvailable(id: string, existingRoleIds: string[]): boolean {
    const normalizedId = id.toLowerCase();
    return !this.RESERVED_IDS.includes(normalizedId) && 
           !existingRoleIds.some(existingId => existingId.toLowerCase() === normalizedId);
  }
}

// Export validation function for use in tools
export function validateCustomRoleInput(input: unknown): CustomRoleConfig {
  const result = RoleValidator.validateCustomRole(input);
  if (!result.valid) {
    throw new ApplicationError(
      `Invalid role configuration: ${result.errors.join(', ')}`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  return result.sanitized!;
}

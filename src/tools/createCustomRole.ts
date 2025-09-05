/**
 * MCP Tool: Create Custom Role
 * Allows users to create their own custom roles
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase } from '../db/helpers.js';
import { getCurrentSystemId } from '../db/helpers.js';
import { validateCustomRoleInput, RoleValidator } from '../utils/roleValidator.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';

const inputSchema = z.object({
  id: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(1000),
  base_role_id: z.string().optional(),
  focus_areas: z.array(z.string()).min(1).max(20),
  default_tags: z.array(z.string()).max(15).default([]),
  preferred_context_types: z.array(z.string()).min(1).max(9)
});

export const createCustomRoleTool: Tool = {
  name: 'create_custom_role',
  description: 'Create a custom role with specific focus areas and preferences',
  
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Unique identifier for the role (alphanumeric, dash, underscore only)'
      },
      name: {
        type: 'string',
        description: 'Display name for the role'
      },
      description: {
        type: 'string',
        description: 'Description of what this role does'
      },
      base_role_id: {
        type: 'string',
        description: 'Optional: ID of existing role to base this on (architect, developer, devops, qa, product)'
      },
      focus_areas: {
        type: 'array',
        items: { type: 'string' },
        description: 'Areas this role focuses on (e.g., ["security", "compliance", "threats"])'
      },
      default_tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags automatically applied to context entries from this role'
      },
      preferred_context_types: {
        type: 'array',
        items: { type: 'string' },
        description: 'Context types this role typically uses (decision, code, standard, status, todo, note, config, issue, reference)'
      }
    },
    required: ['id', 'name', 'description', 'focus_areas', 'preferred_context_types']
  }
};

export async function createCustomRole(input: unknown) {
  const validated = inputSchema.parse(input);
  const db = await getDatabase();
  const systemId = await getCurrentSystemId(db);
  
  // Validate the custom role configuration
  const validatedRole = validateCustomRoleInput({
    ...validated,
    preferred_context_types: validated.preferred_context_types
  });
  
  // Check if role ID already exists
  const existingRole = db.prepare(
    'SELECT id FROM roles WHERE id = ?'
  ).get(validatedRole.id);
  
  if (existingRole) {
    throw new ApplicationError(
      `Role with ID '${validatedRole.id}' already exists`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  
  // Get all existing role IDs for availability check
  const existingRoleIds = db.prepare(
    'SELECT id FROM roles'
  ).all().map((r: any) => r.id);
  
  if (!RoleValidator.isRoleIdAvailable(validatedRole.id, existingRoleIds)) {
    throw new ApplicationError(
      `Role ID '${validatedRole.id}' is not available`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  
  // If base_role_id provided, copy its configuration
  let templateConfig: any = {
    focusAreas: validatedRole.focus_areas,
    defaultTags: validatedRole.default_tags,
    contextTypes: validatedRole.preferred_context_types
  };
  
  if (validated.base_role_id) {
    const baseRole = db.prepare(
      'SELECT template_config FROM roles WHERE id = ? AND is_custom = 0'
    ).get(validated.base_role_id) as { template_config: string } | undefined;
    
    if (!baseRole) {
      throw new ApplicationError(
        `Base role '${validated.base_role_id}' not found or is not a default role`,
        ERROR_CODES.NOT_FOUND
      );
    }
    
    // Merge base configuration with custom configuration
    const baseConfig = JSON.parse(baseRole.template_config || '{}');
    templateConfig = {
      ...baseConfig,
      focusAreas: validatedRole.focus_areas,
      defaultTags: [...new Set([...baseConfig.defaultTags || [], ...validatedRole.default_tags])],
      contextTypes: validatedRole.preferred_context_types
    };
  }
  
  // Insert the new custom role
  db.prepare(`
    INSERT INTO roles (
      id, name, description, is_custom, template_config,
      parent_template, author_system_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(
    validatedRole.id,
    validatedRole.name,
    validatedRole.description,
    1, // is_custom = true
    JSON.stringify(templateConfig),
    validated.base_role_id || null,
    systemId
  );
  
  // Log the creation
  db.prepare(`
    INSERT INTO update_history (entity_type, entity_id, action, changes)
    VALUES ('role', ?, 'create', ?)
  `).run(
    validatedRole.id,
    JSON.stringify({
      role_id: validatedRole.id,
      role_name: validatedRole.name,
      based_on: validated.base_role_id,
      author_system_id: systemId
    })
  );
  
  return `✅ Created custom role: ${validatedRole.name}

🆔 Role ID: ${validatedRole.id}
📝 Description: ${validatedRole.description}
${validated.base_role_id ? `🔗 Based on: ${validated.base_role_id}` : '🆕 Created from scratch'}

🎯 Focus Areas: ${validatedRole.focus_areas.join(', ')}
🏷️  Default Tags: ${validatedRole.default_tags.join(', ') || 'none'}
📋 Context Types: ${validatedRole.preferred_context_types.join(', ')}

You can now switch to this role using:
"Switch to ${validatedRole.id} role for [project-name]"`;
}

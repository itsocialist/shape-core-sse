/**
 * MCP Tool: Store Context (with role support)
 * Stores context entries for projects or shared contexts
 * Now includes role-based context storage
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase } from '../db/helpers.js';
import { getCurrentSystemId, sanitizeInput } from '../utils/security.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';
import { validateJSON } from '../utils/jsonValidation.js';
import { contextTypeSchema } from '../types/schemas.js';

const inputSchema = z.object({
  project_name: z.string().min(1).max(255).optional(),
  type: contextTypeSchema,
  key: z.string().min(1).max(255),
  value: z.string().min(1).max(65535),
  is_system_specific: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  role_id: z.string().min(1).max(50).optional()
});

export const storeContextTool: Tool = {
  name: 'store_context',
  description: `Store context information for a project or as shared context (coding standards, decisions, etc.).
    
Context types:
- decision: Architectural or design decisions
- code: Code snippets or examples  
- standard: Coding standards or conventions
- status: Project status updates
- todo: Tasks or action items
- note: General notes
- config: Configuration details
- issue: Known issues or bugs
- reference: External references or links

The context will be automatically associated with the current active role unless role_id is specified.

Examples:
- "Remember this decision for project 'my-app': We chose PostgreSQL for better JSON support"
- "Store shared coding standard: Always use TypeScript strict mode"
- "Remember this is system-specific for project 'my-app': Database is at localhost:5432"`,
  
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'Project name (omit for shared context)'
      },
      type: {
        type: 'string',
        enum: ['decision', 'code', 'standard', 'status', 'todo', 'note', 'config', 'issue', 'reference'],
        description: 'Type of context entry'
      },
      key: {
        type: 'string',
        description: 'Unique key/title for this context'
      },
      value: {
        type: 'string',
        description: 'The context content/value'
      },
      is_system_specific: {
        type: 'boolean',
        description: 'Whether this context is specific to current system',
        default: false
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for categorization'
      },
      metadata: {
        type: 'object',
        description: 'Additional metadata'
      },
      role_id: {
        type: 'string',
        description: 'Optional role ID. If omitted, uses the current active role for the project'
      }
    },
    required: ['type', 'key', 'value']
  }
};

export async function storeContext(input: unknown) {
  const validated = inputSchema.parse(input);
  const db = await getDatabase();
  const systemId = await getCurrentSystemId(db);
  
  // Validate metadata if provided
  if (validated.metadata) {
    validateJSON(validated.metadata);
  }
  
  // Sanitize inputs
  const key = sanitizeInput(validated.key);
  const value = sanitizeInput(validated.value);
  let tags = validated.tags?.map((tag: string) => sanitizeInput(tag));
  
  return db.transaction(() => {
    let projectId: number | null = null;
    let activeRoleId: string | null = validated.role_id || null;
    let roleName: string | null = null;
    
    // Get project if specified
    if (validated.project_name) {
      const projectName = sanitizeInput(validated.project_name);
      const project = db.prepare(
        'SELECT id FROM projects WHERE name = ?'
      ).get(projectName) as { id: number } | undefined;
      
      if (!project) {
        throw new ApplicationError(
          `Project '${projectName}' not found`,
          ERROR_CODES.NOT_FOUND
        );
      }
      projectId = project.id;
      
      // Get active role if not specified
      if (!activeRoleId) {
        const activeRole = db.prepare(`
          SELECT role_id FROM active_roles
          WHERE project_id = ? AND system_id = ?
        `).get(projectId, systemId) as { role_id: string } | undefined;
        
        activeRoleId = activeRole?.role_id || null;
      }
    }
    
    // Validate role if specified
    if (activeRoleId) {
      const role = db.prepare(
        'SELECT id, name, template_config FROM roles WHERE id = ?'
      ).get(activeRoleId) as { id: string; name: string; template_config: string } | undefined;
      
      if (!role) {
        throw new ApplicationError(
          `Role '${activeRoleId}' not found`,
          ERROR_CODES.NOT_FOUND
        );
      }
      
      roleName = role.name;
      
      // Add role's default tags if available
      const templateConfig = JSON.parse(role.template_config || '{}');
      if (templateConfig.defaultTags && Array.isArray(templateConfig.defaultTags)) {
        const allTags = new Set([...(tags || []), ...templateConfig.defaultTags]);
        tags = Array.from(allTags);
      }
    }
    
    // Check for existing entry
    const existing = db.prepare(`
      SELECT id FROM context_entries 
      WHERE project_id ${projectId ? '= ?' : 'IS NULL'} 
      AND key = ?
    `).get(...(projectId ? [projectId, key] : [key])) as { id: number } | undefined;
    
    let contextId: number;
    
    if (existing) {
      // Update existing entry
      db.prepare(`
        UPDATE context_entries 
        SET value = ?, type = ?, is_system_specific = ?, 
            tags = ?, metadata = ?, role_id = ?,
            system_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        value,
        validated.type,
        validated.is_system_specific ? 1 : 0,
        JSON.stringify(tags || []),
        JSON.stringify(validated.metadata || {}),
        activeRoleId,
        validated.is_system_specific ? systemId : null,
        existing.id
      );
      contextId = existing.id;
    } else {
      // Create new entry
      const result = db.prepare(`
        INSERT INTO context_entries 
        (project_id, system_id, type, key, value, is_system_specific, tags, metadata, role_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        projectId,
        validated.is_system_specific ? systemId : null,
        validated.type,
        key,
        value,
        validated.is_system_specific ? 1 : 0,
        JSON.stringify(tags || []),
        JSON.stringify(validated.metadata || {}),
        activeRoleId
      );
      contextId = Number(result.lastInsertRowid);
    }
    
    // Log the action
    db.prepare(`
      INSERT INTO update_history (entity_type, entity_id, action, changes, user_note)
      VALUES ('context', ?, ?, ?, ?)
    `).run(
      contextId,
      existing ? 'update' : 'create',
      JSON.stringify({
        key,
        type: validated.type,
        project_id: projectId,
        is_system_specific: validated.is_system_specific,
        tags,
        role_id: activeRoleId
      }),
      activeRoleId ? `Role: ${activeRoleId}` : null
    );
    
    // Build response message
    const parts = [
      `✅ Stored ${validated.type} context: "${key}"`,
      validated.project_name 
        ? `📁 Project: ${validated.project_name}`
        : `🌐 Shared context (available to all projects)`
    ];
    
    if (roleName) {
      parts.push(`👤 Role: ${roleName}`);
    }
    
    if (validated.is_system_specific) {
      const system = db.prepare('SELECT name FROM systems WHERE id = ?')
        .get(systemId) as { name: string } | undefined;
      parts.push(`💻 System-specific to: ${system?.name || 'current system'}`);
    }
    
    if (tags && tags.length > 0) {
      parts.push(`🏷️  Tags: ${tags.join(', ')}`);
    }
    
    // Show preview of value if not too long
    if (value.length <= 100) {
      parts.push(`📝 Value: ${value}`);
    } else {
      parts.push(`📝 Value: ${value.substring(0, 97)}...`);
    }
    
    return parts.join('\n');
  }) as any;
}

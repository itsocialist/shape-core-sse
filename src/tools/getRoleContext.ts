/**
 * Get all context entries for a specific role
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase } from '../db/helpers.js';
import { sanitizeInput } from '../utils/security.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';

const inputSchema = z.object({
  project_name: z.string().min(1).max(255),
  role_id: z.string().min(1).max(50),
  include_shared: z.boolean().default(false),
  limit: z.number().min(1).max(1000).default(100)
});

export const getRoleContextTool: Tool = {
  name: 'get_role_context',
  description: 'Get all context entries for a specific role in a project. Returns contexts created by or relevant to the specified role.',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'Name of the project'
      },
      role_id: {
        type: 'string',
        description: 'ID of the role to get context for'
      },
      include_shared: {
        type: 'boolean',
        description: 'Include shared (non-project) contexts',
        default: false
      },
      limit: {
        type: 'number',
        description: 'Maximum number of entries to return',
        default: 100
      }
    },
    required: ['project_name', 'role_id']
  }
};

export async function getRoleContext(input: unknown) {
  const validated = inputSchema.parse(input);
  const db = await getDatabase();
  
  const projectName = sanitizeInput(validated.project_name);
  const roleId = sanitizeInput(validated.role_id);
  
  // Get project
  const project = db.prepare(
    'SELECT id, name FROM projects WHERE name = ?'
  ).get(projectName) as { id: number; name: string } | undefined;
  
  if (!project) {
    throw new ApplicationError(
      `Project '${projectName}' not found`,
      ERROR_CODES.NOT_FOUND
    );
  }
  
  // Verify role exists
  const role = db.prepare(
    'SELECT id, name, description FROM roles WHERE id = ?'
  ).get(roleId) as { id: string; name: string; description: string } | undefined;
  
  if (!role) {
    throw new ApplicationError(
      `Role '${roleId}' not found`,
      ERROR_CODES.NOT_FOUND
    );
  }
  
  // Get role-specific contexts
  const contexts = db.prepare(`
    SELECT 
      ce.id,
      ce.type,
      ce.key,
      ce.value,
      ce.is_system_specific,
      ce.tags,
      ce.metadata,
      ce.created_at,
      ce.updated_at,
      s.name as system_name
    FROM context_entries ce
    LEFT JOIN systems s ON ce.system_id = s.id
    WHERE ce.project_id = ? AND ce.role_id = ?
    ORDER BY ce.updated_at DESC
    LIMIT ?
  `).all(project.id, roleId, validated.limit) as Array<{
    id: number;
    type: string;
    key: string;
    value: string;
    is_system_specific: number;
    tags: string;
    metadata: string;
    created_at: string;
    updated_at: string;
    system_name: string | null;
  }>;
  
  // Get shared contexts if requested
  let sharedContexts: typeof contexts = [];
  if (validated.include_shared) {
    sharedContexts = db.prepare(`
      SELECT 
        ce.id,
        ce.type,
        ce.key,
        ce.value,
        ce.is_system_specific,
        ce.tags,
        ce.metadata,
        ce.created_at,
        ce.updated_at,
        s.name as system_name
      FROM context_entries ce
      LEFT JOIN systems s ON ce.system_id = s.id
      WHERE ce.project_id IS NULL AND ce.role_id = ?
      ORDER BY ce.updated_at DESC
      LIMIT ?
    `).all(roleId, Math.floor(validated.limit / 4)) as typeof contexts; // Limit shared to 25% of total
  }
  
  // Get role statistics
  const stats = db.prepare(`
    SELECT 
      type,
      COUNT(*) as count
    FROM context_entries
    WHERE project_id = ? AND role_id = ?
    GROUP BY type
  `).all(project.id, roleId) as Array<{ type: string; count: number }>;
  
  // Format results
  const formatContext = (ctx: typeof contexts[0]) => ({
    id: ctx.id,
    type: ctx.type,
    key: ctx.key,
    value: ctx.value,
    isSystemSpecific: Boolean(ctx.is_system_specific),
    systemName: ctx.system_name,
    tags: JSON.parse(ctx.tags || '[]'),
    metadata: JSON.parse(ctx.metadata || '{}'),
    createdAt: ctx.created_at,
    updatedAt: ctx.updated_at
  });
  
  return {
    project: {
      id: project.id,
      name: project.name
    },
    role: {
      id: role.id,
      name: role.name,
      description: role.description
    },
    contexts: {
      project: contexts.map(formatContext),
      shared: sharedContexts.map(formatContext)
    },
    statistics: {
      totalEntries: contexts.length + sharedContexts.length,
      byType: stats.reduce((acc, s) => ({ ...acc, [s.type]: s.count }), {}),
      projectEntries: contexts.length,
      sharedEntries: sharedContexts.length
    }
  };
}

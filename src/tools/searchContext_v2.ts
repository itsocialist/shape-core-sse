/**
 * MCP Tool: Search Context (with role support)
 * Flexible search across all context entries with role filtering
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase } from '../db/helpers.js';
import { sanitizeInput } from '../utils/security.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';

const inputSchema = z.object({
  query: z.string().optional(),
  project_name: z.string().min(1).max(255).optional(),
  type: z.enum(['decision', 'code', 'standard', 'status', 'todo', 'note', 'config', 'issue', 'reference']).optional(),
  tags: z.array(z.string()).optional(),
  since: z.string().optional(),
  limit: z.number().min(1).max(1000).default(20),
  role_id: z.string().min(1).max(50).optional(),
  cross_role: z.boolean().default(true),
  include_handoffs: z.boolean().default(false)
});

export const searchContextTool: Tool = {
  name: 'search_context',
  description: `Search for context entries across projects with flexible filters including role-based filtering.
    
Examples:
- "What was updated yesterday?" - search by time
- "Show all decisions for project 'my-app'" - search by type and project
- "Find all contexts tagged with 'database'" - search by tags
- "Search for PostgreSQL" - full-text search
- "What are our coding standards?" - search shared contexts
- "Show developer contexts for project 'my-app'" - search by role and project
- "Find architect decisions" - search by role and type`,
  
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Full-text search query'
      },
      project_name: {
        type: 'string',
        description: 'Filter by project name (omit for all projects)'
      },
      type: {
        type: 'string',
        enum: ['decision', 'code', 'standard', 'status', 'todo', 'note', 'config', 'issue', 'reference'],
        description: 'Filter by context type'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags (OR operation)'
      },
      since: {
        type: 'string',
        description: 'Time filter (e.g., "-1 day", "-1 week", "-1 hour")'
      },
      limit: {
        type: 'integer',
        description: 'Maximum results to return',
        default: 20
      },
      role_id: {
        type: 'string',
        description: 'Filter by role ID (e.g., architect, developer)'
      },
      cross_role: {
        type: 'boolean',
        description: 'Include contexts from all roles (default true)',
        default: true
      },
      include_handoffs: {
        type: 'boolean',
        description: 'Include role handoffs in results',
        default: false
      }
    }
  }
};

export async function searchContext(input: unknown) {
  const validated = inputSchema.parse(input);
  const db = await getDatabase();
  
  // Build query conditions
  const conditions: string[] = [];
  const params: any[] = [];
  
  // Project filter
  let projectId: number | null = null;
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
    conditions.push('ce.project_id = ?');
    params.push(projectId);
  }
  
  // Role filter
  if (validated.role_id && !validated.cross_role) {
    const roleId = sanitizeInput(validated.role_id);
    conditions.push('ce.role_id = ?');
    params.push(roleId);
  }
  
  // Type filter
  if (validated.type) {
    conditions.push('ce.type = ?');
    params.push(validated.type);
  }
  
  // Time filter
  if (validated.since) {
    const sinceDate = parseSinceDate(validated.since);
    conditions.push('ce.updated_at > ?');
    params.push(sinceDate.toISOString());
  }
  
  // Tags filter (OR operation)
  if (validated.tags && validated.tags.length > 0) {
    const tagConditions = validated.tags.map(() => "ce.tags LIKE ?");
    conditions.push(`(${tagConditions.join(' OR ')})`);
    validated.tags.forEach(tag => {
      params.push(`%"${sanitizeInput(tag)}"%`);
    });
  }
  
  // Build base query
  let query = `
    SELECT 
      ce.id,
      ce.project_id,
      ce.type,
      ce.key,
      ce.value,
      ce.is_system_specific,
      ce.tags,
      ce.metadata,
      ce.role_id,
      ce.created_at,
      ce.updated_at,
      p.name as project_name,
      r.name as role_name,
      s.name as system_name
    FROM context_entries ce
    LEFT JOIN projects p ON ce.project_id = p.id
    LEFT JOIN roles r ON ce.role_id = r.id
    LEFT JOIN systems s ON ce.system_id = s.id
  `;
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  // Add full-text search if query provided
  if (validated.query) {
    const searchQuery = sanitizeInput(validated.query);
    if (conditions.length > 0) {
      query += ' AND';
    } else {
      query += ' WHERE';
    }
    query += ' (ce.key LIKE ? OR ce.value LIKE ?)';
    params.push(`%${searchQuery}%`, `%${searchQuery}%`);
  }
  
  query += ' ORDER BY ce.updated_at DESC LIMIT ?';
  params.push(validated.limit);
  
  // Execute search
  const contexts = db.prepare(query).all(...params) as Array<{
    id: number;
    project_id: number | null;
    type: string;
    key: string;
    value: string;
    is_system_specific: number;
    tags: string;
    metadata: string;
    role_id: string | null;
    created_at: string;
    updated_at: string;
    project_name: string | null;
    role_name: string | null;
    system_name: string | null;
  }>;
  
  // Search handoffs if requested
  let handoffs: Array<any> = [];
  if (validated.include_handoffs) {
    let handoffQuery = `
      SELECT 
        h.id,
        h.project_id,
        h.from_role_id,
        h.to_role_id,
        h.handoff_data,
        h.created_at,
        p.name as project_name,
        fr.name as from_role_name,
        tr.name as to_role_name
      FROM role_handoffs h
      JOIN projects p ON h.project_id = p.id
      JOIN roles fr ON h.from_role_id = fr.id
      JOIN roles tr ON h.to_role_id = tr.id
    `;
    
    const handoffConditions: string[] = [];
    const handoffParams: any[] = [];
    
    if (projectId) {
      handoffConditions.push('h.project_id = ?');
      handoffParams.push(projectId);
    }
    
    if (validated.role_id) {
      handoffConditions.push('(h.from_role_id = ? OR h.to_role_id = ?)');
      handoffParams.push(validated.role_id, validated.role_id);
    }
    
    if (validated.since) {
      const sinceDate = parseSinceDate(validated.since);
      handoffConditions.push('h.created_at > ?');
      handoffParams.push(sinceDate.toISOString());
    }
    
    if (handoffConditions.length > 0) {
      handoffQuery += ' WHERE ' + handoffConditions.join(' AND ');
    }
    
    handoffQuery += ' ORDER BY h.created_at DESC LIMIT ?';
    handoffParams.push(Math.floor(validated.limit / 4)); // Limit handoffs to 25% of total
    
    handoffs = db.prepare(handoffQuery).all(...handoffParams);
  }
  
  // Format results
  const formattedContexts = contexts.map(ctx => ({
    id: ctx.id,
    type: ctx.type,
    key: ctx.key,
    value: ctx.value,
    projectName: ctx.project_name,
    roleName: ctx.role_name,
    isSystemSpecific: Boolean(ctx.is_system_specific),
    systemName: ctx.system_name,
    tags: JSON.parse(ctx.tags || '[]'),
    metadata: JSON.parse(ctx.metadata || '{}'),
    createdAt: ctx.created_at,
    updatedAt: ctx.updated_at
  }));
  
  const formattedHandoffs = handoffs.map(h => {
    const data = JSON.parse(h.handoff_data);
    return {
      id: h.id,
      type: 'handoff',
      projectName: h.project_name,
      fromRole: h.from_role_name,
      toRole: h.to_role_name,
      summary: data.summary,
      keyDecisions: data.keyDecisions?.length || 0,
      pendingTasks: data.pendingTasks?.length || 0,
      createdAt: h.created_at
    };
  });
  
  return {
    results: [...formattedContexts, ...formattedHandoffs],
    total: formattedContexts.length + formattedHandoffs.length,
    filters: {
      query: validated.query,
      project: validated.project_name,
      type: validated.type,
      role: validated.role_id,
      crossRole: validated.cross_role,
      tags: validated.tags,
      since: validated.since
    }
  };
}

function parseSinceDate(since: string): Date {
  const now = new Date();
  const match = since.match(/^-(\d+)\s*(hour|day|week|month)s?$/);
  
  if (!match) {
    throw new ApplicationError(
      'Invalid time format. Use format like "-1 day", "-2 weeks"',
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  
  const [, amount, unit] = match;
  const value = parseInt(amount);
  
  switch (unit) {
    case 'hour':
      now.setHours(now.getHours() - value);
      break;
    case 'day':
      now.setDate(now.getDate() - value);
      break;
    case 'week':
      now.setDate(now.getDate() - (value * 7));
      break;
    case 'month':
      now.setMonth(now.getMonth() - value);
      break;
  }
  
  return now;
}

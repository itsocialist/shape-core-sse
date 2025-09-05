/**
 * Get a role-specific summary of a project
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase } from '../db/helpers.js';
import { getCurrentSystemId, sanitizeInput } from '../utils/security.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';

const inputSchema = z.object({
  project_name: z.string().min(1).max(255),
  role_id: z.string().min(1).max(50).optional(),
  days_back: z.number().min(1).max(365).default(30)
});

export const getRoleSummaryTool: Tool = {
  name: 'get_role_summary',
  description: `Get a role-specific summary of project activity including key decisions, recent work, and pending items.
  
  If role_id is not specified, uses the current active role.`,
  
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'Name of the project'
      },
      role_id: {
        type: 'string',
        description: 'ID of the role (optional, uses current active role if not specified)'
      },
      days_back: {
        type: 'number',
        description: 'Number of days to look back for recent activity',
        default: 30
      }
    },
    required: ['project_name']
  }
};

export async function getRoleSummary(input: unknown) {
  const validated = inputSchema.parse(input);
  const db = await getDatabase();
  const systemId = await getCurrentSystemId(db);
  
  const projectName = sanitizeInput(validated.project_name);
  
  // Get project
  const project = db.prepare(
    'SELECT id, name, description, status FROM projects WHERE name = ?'
  ).get(projectName) as { id: number; name: string; description: string; status: string } | undefined;
  
  if (!project) {
    throw new ApplicationError(
      `Project '${projectName}' not found`,
      ERROR_CODES.NOT_FOUND
    );
  }
  
  // Determine role
  let roleId = validated.role_id;
  if (!roleId) {
    const activeRole = db.prepare(`
      SELECT role_id FROM active_roles
      WHERE project_id = ? AND system_id = ?
    `).get(project.id, systemId) as { role_id: string } | undefined;
    
    if (!activeRole) {
      throw new ApplicationError(
        'No active role found. Please specify a role or switch to one.',
        ERROR_CODES.VALIDATION_ERROR
      );
    }
    roleId = activeRole.role_id;
  } else {
    roleId = sanitizeInput(roleId);
  }
  
  // Verify role exists
  const role = db.prepare(
    'SELECT id, name, description, template_config FROM roles WHERE id = ?'
  ).get(roleId) as { id: string; name: string; description: string; template_config: string } | undefined;
  
  if (!role) {
    throw new ApplicationError(
      `Role '${roleId}' not found`,
      ERROR_CODES.NOT_FOUND
    );
  }
  
  const templateConfig = JSON.parse(role.template_config || '{}');
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - validated.days_back);
  
  // Get key decisions
  const decisions = db.prepare(`
    SELECT key, value, updated_at
    FROM context_entries
    WHERE project_id = ? AND role_id = ? AND type = 'decision'
    ORDER BY updated_at DESC
    LIMIT 5
  `).all(project.id, roleId) as Array<{ key: string; value: string; updated_at: string }>;
  
  // Get recent activity
  const recentActivity = db.prepare(`
    SELECT type, COUNT(*) as count, MAX(updated_at) as last_update
    FROM context_entries
    WHERE project_id = ? AND role_id = ? AND updated_at > ?
    GROUP BY type
    ORDER BY count DESC
  `).all(project.id, roleId, cutoffDate.toISOString()) as Array<{ 
    type: string; 
    count: number; 
    last_update: string;
  }>;
  
  // Get pending todos
  const pendingTodos = db.prepare(`
    SELECT key, value, created_at
    FROM context_entries
    WHERE project_id = ? AND role_id = ? AND type = 'todo'
    ORDER BY created_at DESC
    LIMIT 10
  `).all(project.id, roleId) as Array<{ key: string; value: string; created_at: string }>;
  
  // Get recent issues
  const recentIssues = db.prepare(`
    SELECT key, value, updated_at
    FROM context_entries
    WHERE project_id = ? AND role_id = ? AND type = 'issue'
    ORDER BY updated_at DESC
    LIMIT 5
  `).all(project.id, roleId) as Array<{ key: string; value: string; updated_at: string }>;
  
  // Get incoming handoffs
  const incomingHandoffs = db.prepare(`
    SELECT 
      h.id,
      h.handoff_data,
      h.created_at,
      r.name as from_role_name
    FROM role_handoffs h
    JOIN roles r ON h.from_role_id = r.id
    WHERE h.project_id = ? AND h.to_role_id = ?
    ORDER BY h.created_at DESC
    LIMIT 3
  `).all(project.id, roleId) as Array<{
    id: string;
    handoff_data: string;
    created_at: string;
    from_role_name: string;
  }>;
  
  // Get outgoing handoffs
  const outgoingHandoffs = db.prepare(`
    SELECT 
      h.id,
      h.handoff_data,
      h.created_at,
      r.name as to_role_name
    FROM role_handoffs h
    JOIN roles r ON h.to_role_id = r.id
    WHERE h.project_id = ? AND h.from_role_id = ?
    ORDER BY h.created_at DESC
    LIMIT 3
  `).all(project.id, roleId) as Array<{
    id: string;
    handoff_data: string;
    created_at: string;
    to_role_name: string;
  }>;
  
  // Format handoffs
  const formatHandoff = (h: { id: string; handoff_data: string; created_at: string; }) => {
    const data = JSON.parse(h.handoff_data);
    return {
      id: h.id,
      summary: data.summary,
      createdAt: h.created_at,
      keyDecisions: data.keyDecisions?.length || 0,
      pendingTasks: data.pendingTasks?.length || 0
    };
  };
  
  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status
    },
    role: {
      id: role.id,
      name: role.name,
      description: role.description,
      focusAreas: templateConfig.focusAreas || []
    },
    summary: {
      keyDecisions: decisions.map(d => ({
        title: d.key,
        decision: d.value.length > 100 ? d.value.substring(0, 97) + '...' : d.value,
        date: d.updated_at
      })),
      recentActivity: {
        period: `Last ${validated.days_back} days`,
        totalEntries: recentActivity.reduce((sum, a) => sum + a.count, 0),
        byType: recentActivity.map(a => ({
          type: a.type,
          count: a.count,
          lastUpdate: a.last_update
        }))
      },
      pendingItems: {
        todos: pendingTodos.map(t => ({
          title: t.key,
          description: t.value.length > 100 ? t.value.substring(0, 97) + '...' : t.value,
          created: t.created_at
        })),
        issues: recentIssues.map(i => ({
          title: i.key,
          description: i.value.length > 100 ? i.value.substring(0, 97) + '...' : i.value,
          updated: i.updated_at
        }))
      },
      handoffs: {
        incoming: incomingHandoffs.map(h => ({
          ...formatHandoff(h),
          fromRole: h.from_role_name
        })),
        outgoing: outgoingHandoffs.map(h => ({
          ...formatHandoff(h),
          toRole: h.to_role_name
        }))
      }
    }
  };
}

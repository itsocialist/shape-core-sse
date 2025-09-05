/**
 * Create a handoff between roles
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { getDatabase } from '../db/helpers.js';
import { getCurrentSystemId, sanitizeInput } from '../utils/security.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';
import { validateJSON } from '../utils/jsonValidation.js';

const inputSchema = z.object({
  project_name: z.string().min(1).max(255),
  from_role: z.string().min(1).max(50).optional(),
  to_role: z.string().min(1).max(50),
  summary: z.string().min(1).max(1000),
  key_decisions: z.array(z.string()).default([]),
  pending_tasks: z.array(z.string()).default([]),
  warnings: z.array(z.string()).optional(),
  context: z.record(z.any()).optional()
});

export const createHandoffTool: Tool = {
  name: 'create_handoff',
  description: `Create a handoff between roles to transfer important context and responsibilities. 
  
  If from_role is not specified, uses the current active role.
  
  Examples:
  - Architect → Developer: Key design decisions and implementation constraints
  - Developer → DevOps: Deployment requirements and configuration needs
  - QA → Developer: Bug reports and testing feedback`,
  
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'Name of the project'
      },
      from_role: {
        type: 'string',
        description: 'Role handing off (optional, uses current active role if not specified)'
      },
      to_role: {
        type: 'string',
        description: 'Role receiving the handoff'
      },
      summary: {
        type: 'string',
        description: 'Brief summary of what is being handed off'
      },
      key_decisions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Important decisions made that the next role should know'
      },
      pending_tasks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tasks that need to be completed by the receiving role'
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Important warnings or gotchas'
      },
      context: {
        type: 'object',
        description: 'Additional context data'
      }
    },
    required: ['project_name', 'to_role', 'summary']
  }
};

export async function createHandoff(input: unknown) {
  const validated = inputSchema.parse(input);
  const db = await getDatabase();
  const systemId = await getCurrentSystemId(db);
  
  // Validate context if provided
  if (validated.context) {
    validateJSON(validated.context);
  }
  
  const projectName = sanitizeInput(validated.project_name);
  const toRoleId = sanitizeInput(validated.to_role);
  
  return db.transaction(() => {
    // Get project
    const project = db.prepare(
      'SELECT id FROM projects WHERE name = ?'
    ).get(projectName) as { id: number } | undefined;
    
    if (!project) {
      throw new ApplicationError(
        `Project '${projectName}' not found`,
        ERROR_CODES.NOT_FOUND
      );
    }
    
    // Determine from_role
    let fromRoleId = validated.from_role;
    if (!fromRoleId) {
      // Get current active role
      const activeRole = db.prepare(`
        SELECT role_id FROM active_roles
        WHERE project_id = ? AND system_id = ?
      `).get(project.id, systemId) as { role_id: string } | undefined;
      
      if (!activeRole) {
        throw new ApplicationError(
          'No active role found. Please switch to a role first.',
          ERROR_CODES.VALIDATION_ERROR
        );
      }
      fromRoleId = activeRole.role_id;
    } else {
      fromRoleId = sanitizeInput(fromRoleId);
    }
    
    // Verify both roles exist
    const fromRole = db.prepare(
      'SELECT id, name FROM roles WHERE id = ?'
    ).get(fromRoleId) as { id: string; name: string } | undefined;
    
    const toRole = db.prepare(
      'SELECT id, name FROM roles WHERE id = ?'
    ).get(toRoleId) as { id: string; name: string } | undefined;
    
    if (!fromRole) {
      throw new ApplicationError(
        `Role '${fromRoleId}' not found`,
        ERROR_CODES.NOT_FOUND
      );
    }
    
    if (!toRole) {
      throw new ApplicationError(
        `Role '${toRoleId}' not found`,
        ERROR_CODES.NOT_FOUND
      );
    }
    
    // Can't handoff to same role
    if (fromRoleId === toRoleId) {
      throw new ApplicationError(
        'Cannot create handoff to the same role',
        ERROR_CODES.VALIDATION_ERROR
      );
    }
    
    // Create handoff data
    const handoffData = {
      summary: sanitizeInput(validated.summary),
      keyDecisions: validated.key_decisions.map(d => sanitizeInput(d)),
      pendingTasks: validated.pending_tasks.map(t => sanitizeInput(t)),
      warnings: validated.warnings?.map(w => sanitizeInput(w)),
      context: validated.context,
      createdAt: new Date().toISOString()
    };
    
    // Insert handoff
    const handoffId = randomUUID();
    db.prepare(`
      INSERT INTO role_handoffs (id, project_id, from_role_id, to_role_id, handoff_data, created_by_system_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      handoffId,
      project.id,
      fromRoleId,
      toRoleId,
      JSON.stringify(handoffData),
      systemId
    );
    
    // Log the handoff
    db.prepare(`
      INSERT INTO update_history (entity_type, entity_id, action, changes, user_note)
      VALUES ('project', ?, 'create_handoff', json(?), ?)
    `).run(
      project.id,
      JSON.stringify({
        handoff_id: handoffId,
        from_role: fromRoleId,
        to_role: toRoleId,
        summary: handoffData.summary
      }),
      fromRoleId
    );
    
    // Get recent context from the from_role
    const recentContext = db.prepare(`
      SELECT type, COUNT(*) as count
      FROM context_entries
      WHERE project_id = ? AND role_id = ?
      GROUP BY type
    `).all(project.id, fromRoleId) as Array<{ type: string; count: number }>;
    
    return {
      handoffId,
      project: projectName,
      from: {
        id: fromRole.id,
        name: fromRole.name
      },
      to: {
        id: toRole.id,
        name: toRole.name
      },
      summary: handoffData.summary,
      details: {
        keyDecisions: handoffData.keyDecisions.length,
        pendingTasks: handoffData.pendingTasks.length,
        warnings: handoffData.warnings?.length || 0
      },
      fromRoleContext: {
        totalEntries: recentContext.reduce((sum, r) => sum + r.count, 0),
        byType: recentContext
      },
      suggestion: `${toRole.name} can now switch to this project and view the handoff details.`
    };
  }) as any;
}

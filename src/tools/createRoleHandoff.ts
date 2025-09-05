/**
 * Create a handoff between roles
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase } from '../db/helpers.js';
import { getCurrentSystemId } from '../db/helpers.js';
import { sanitizeInput } from '../utils/security.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';
import { randomUUID } from 'crypto';

const inputSchema = z.object({
  project_name: z.string().min(1).max(255),
  to_role_id: z.string().min(1).max(50),
  summary: z.string().min(1).max(1000),
  key_decisions: z.array(z.string()).optional(),
  pending_tasks: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional()
});

export const createRoleHandoffTool: Tool = {
  name: 'create_role_handoff',
  description: 'Create a handoff from your current role to another role',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'The name of the project'
      },
      to_role_id: {
        type: 'string',
        description: 'The ID of the role to hand off to (e.g., developer, devops, qa)'
      },
      summary: {
        type: 'string',
        description: 'Summary of work completed and current state'
      },
      key_decisions: {
        type: 'array',
        items: { type: 'string' },
        description: 'Important decisions made (optional)'
      },
      pending_tasks: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tasks that need to be completed (optional)'
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Important warnings or blockers (optional)'
      }
    },
    required: ['project_name', 'to_role_id', 'summary']
  }
};

export async function createRoleHandoff(input: unknown) {
  const validated = inputSchema.parse(input);
  const db = await getDatabase();
  const systemId = await getCurrentSystemId(db);
  
  const projectName = sanitizeInput(validated.project_name);
  
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
  
  // Get current active role
  const activeRole = db.prepare(`
    SELECT role_id FROM active_roles 
    WHERE project_id = ? AND system_id = ?
  `).get(project.id, systemId) as { role_id: string } | undefined;
  
  if (!activeRole) {
    throw new ApplicationError(
      'No active role set. Please switch to a role first.',
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  
  // Verify to_role exists
  const toRole = db.prepare(
    'SELECT id, name FROM roles WHERE id = ?'
  ).get(validated.to_role_id) as { id: string; name: string } | undefined;
  
  if (!toRole) {
    throw new ApplicationError(
      `Role '${validated.to_role_id}' not found`,
      ERROR_CODES.NOT_FOUND
    );
  }
  
  // Get from role name
  const fromRole = db.prepare(
    'SELECT name FROM roles WHERE id = ?'
  ).get(activeRole.role_id) as { name: string };
  
  // Create handoff data
  const handoffData = {
    summary: validated.summary,
    keyDecisions: validated.key_decisions || [],
    pendingTasks: validated.pending_tasks || [],
    warnings: validated.warnings || []
  };
  
  // Insert handoff
  const handoffId = randomUUID();
  db.prepare(`
    INSERT INTO role_handoffs (
      id, project_id, from_role_id, to_role_id, handoff_data, created_at
    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    handoffId,
    project.id,
    activeRole.role_id,
    validated.to_role_id,
    JSON.stringify(handoffData)
  );
  
  return `✅ Handoff created from ${fromRole.name} to ${toRole.name}

📋 Summary: ${validated.summary}

${validated.key_decisions?.length ? `🎯 Key Decisions:
${validated.key_decisions.map(d => `• ${d}`).join('\n')}
` : ''}
${validated.pending_tasks?.length ? `📝 Pending Tasks:
${validated.pending_tasks.map(t => `• ${t}`).join('\n')}
` : ''}
${validated.warnings?.length ? `⚠️ Warnings:
${validated.warnings.map(w => `• ${w}`).join('\n')}
` : ''}
To complete the handoff, switch to the ${toRole.name} role:
"Switch to ${validated.to_role_id} role for ${projectName}"`;
}

/**
 * Get role handoffs for a project
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase } from '../db/helpers.js';
import { sanitizeInput } from '../utils/security.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';

const inputSchema = z.object({
  project_name: z.string().min(1).max(255),
  limit: z.number().min(1).max(50).optional().default(10)
});

export const getRoleHandoffsTool: Tool = {
  name: 'get_role_handoffs',
  description: 'View handoff history for a project',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'The name of the project'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of handoffs to return (default: 10)'
      }
    },
    required: ['project_name']
  }
};

export async function getRoleHandoffs(input: unknown) {
  const validated = inputSchema.parse(input);
  const db = await getDatabase();
  
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
  
  // Get handoffs
  const handoffs = db.prepare(`
    SELECT 
      h.id,
      h.from_role_id,
      h.to_role_id,
      h.handoff_data,
      h.created_at,
      fr.name as from_role_name,
      tr.name as to_role_name
    FROM role_handoffs h
    JOIN roles fr ON h.from_role_id = fr.id
    JOIN roles tr ON h.to_role_id = tr.id
    WHERE h.project_id = ?
    ORDER BY h.created_at DESC
    LIMIT ?
  `).all(project.id, validated.limit) as any[];
  
  if (handoffs.length === 0) {
    return `No handoffs found for project '${projectName}'`;
  }
  
  let output = `📋 Role Handoffs for ${projectName}\n`;
  output += `Found ${handoffs.length} handoff${handoffs.length > 1 ? 's' : ''}\n\n`;
  
  handoffs.forEach((handoff, index) => {
    const data = JSON.parse(handoff.handoff_data);
    const date = new Date(handoff.created_at).toLocaleString();
    
    output += `${index + 1}. ${handoff.from_role_name} → ${handoff.to_role_name}\n`;
    output += `   📅 ${date}\n`;
    output += `   📝 ${data.summary}\n`;
    
    if (data.keyDecisions?.length > 0) {
      output += `   🎯 Key Decisions:\n`;
      data.keyDecisions.forEach((d: string) => {
        output += `      • ${d}\n`;
      });
    }
    
    if (data.pendingTasks?.length > 0) {
      output += `   📋 Pending Tasks:\n`;
      data.pendingTasks.forEach((t: string) => {
        output += `      • ${t}\n`;
      });
    }
    
    if (data.warnings?.length > 0) {
      output += `   ⚠️ Warnings:\n`;
      data.warnings.forEach((w: string) => {
        output += `      • ${w}\n`;
      });
    }
    
    output += '\n';
  });
  
  return output.trim();
}

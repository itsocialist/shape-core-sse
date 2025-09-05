/**
 * Get the currently active role for a project
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase } from '../db/helpers.js';
import { getCurrentSystemId } from '../db/helpers.js';
import { sanitizeInput } from '../utils/security.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';

const inputSchema = z.object({
  project_name: z.string().min(1).max(255)
});

export const getActiveRoleTool: Tool = {
  name: 'get_active_role',
  description: 'Get the currently active role for a specific project',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'The name of the project'
      }
    },
    required: ['project_name']
  }
};

export async function getActiveRole(input: unknown) {
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
  
  // Get active role
  const activeRole = db.prepare(`
    SELECT 
      ar.role_id,
      ar.activated_at,
      r.name as role_name,
      r.description,
      r.template_config
    FROM active_roles ar
    JOIN roles r ON ar.role_id = r.id
    WHERE ar.project_id = ? AND ar.system_id = ?
  `).get(project.id, systemId) as any;
  
  if (!activeRole) {
    return {
      project_name: projectName,
      active_role: null,
      message: `No active role set for project '${projectName}' on this system`
    };
  }
  
  const templateConfig = JSON.parse(activeRole.template_config || '{}');
  
  return {
    project_name: projectName,
    active_role: {
      id: activeRole.role_id,
      name: activeRole.role_name,
      description: activeRole.description,
      activated_at: activeRole.activated_at,
      focus_areas: templateConfig.focusAreas || [],
      default_tags: templateConfig.defaultTags || [],
      preferred_context_types: templateConfig.contextTypes || []
    }
  };
}

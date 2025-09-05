/**
 * List available roles for a project or globally
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase } from '../db/helpers.js';
import { getCurrentSystemId } from '../db/helpers.js';
import { sanitizeInput } from '../utils/security.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';

const inputSchema = z.object({
  project_name: z.string().min(1).max(255).optional()
});

export const listRolesTool: Tool = {
  name: 'list_roles',
  description: 'List all available roles and their project assignments',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'Optional project name to see project-specific role status'
      }
    }
  }
};

export async function listRoles(input: unknown) {
  const validated = inputSchema.parse(input);
  const db = await getDatabase();
  const systemId = await getCurrentSystemId(db);
  
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
  }

  // Get all roles
  const roles = db.prepare(`
    SELECT 
      r.id,
      r.name,
      r.description,
      r.is_custom,
      r.template_config,
      r.created_at
    FROM roles r
    ORDER BY r.is_custom ASC, r.name ASC
  `).all();
  
  // Get active role for project if specified
  let activeRoleId: string | null = null;
  let projectRoleStatus: Record<string, boolean> = {};
  
  if (projectId) {
    const activeRole = db.prepare(`
      SELECT role_id 
      FROM active_roles 
      WHERE project_id = ? AND system_id = ?
    `).get(projectId, systemId) as { role_id: string } | undefined;
    
    activeRoleId = activeRole?.role_id || null;
    
    // Get project-specific role status
    const projectRoles = db.prepare(`
      SELECT role_id, is_active
      FROM project_roles
      WHERE project_id = ?
    `).all(projectId) as Array<{ role_id: string; is_active: number }>;
    
    projectRoles.forEach((pr: any) => {
      projectRoleStatus[pr.role_id] = pr.is_active;
    });
  }
  
  // Format roles with additional info
  const formattedRoles = roles.map((role: any) => {
    const templateConfig = JSON.parse(role.template_config || '{}');
    const isActive = projectId ? (projectRoleStatus[role.id] !== false) : true;
    
    return {
      id: role.id,
      name: role.name,
      description: role.description,
      isCustom: Boolean(role.is_custom),
      isActive: isActive,
      isCurrent: role.id === activeRoleId,
      focusAreas: templateConfig.focusAreas || [],
      defaultTags: templateConfig.defaultTags || [],
      preferredContextTypes: templateConfig.contextTypes || []
    };
  });
  
  return {
    roles: formattedRoles,
    currentRole: activeRoleId,
    projectName: validated.project_name || null,
    summary: {
      total: roles.length,
      custom: roles.filter((r: any) => r.is_custom).length,
      default: roles.filter((r: any) => !r.is_custom).length
    }
  };
}

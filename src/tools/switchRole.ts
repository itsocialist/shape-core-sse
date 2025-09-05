/**
 * Optimized role switching with memory efficiency and bug fixes
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase } from '../db/helpers.js';
import { getCurrentSystemId } from '../db/helpers.js';
import { sanitizeInput } from '../utils/security.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';
import { ResponseFormatter } from '../utils/responseFormatter.js';

const inputSchema = z.object({
  project_name: z.string().min(1).max(255),
  role_id: z.string().min(1).max(50)
});

export const switchRoleTool: Tool = {
  name: 'switch_role',
  description: 'Switch to a different role for a project',
  inputSchema: {
    type: 'object',
    properties: {
      project_name: {
        type: 'string',
        description: 'The name of the project'
      },
      role_id: {
        type: 'string',
        description: 'The ID of the role to switch to (e.g., architect, developer, devops, qa, product)'
      }
    },
    required: ['project_name', 'role_id']
  }
};

export async function switchRole(input: unknown) {
  const validated = inputSchema.parse(input);
  const db = await getDatabase();
  const systemId = await getCurrentSystemId(db);
  
  const projectName = sanitizeInput(validated.project_name);
  const roleId = sanitizeInput(validated.role_id);
  
  // OPTIMIZATION: Single query with case-insensitive lookup and role validation
  const result = db.prepare(`
    SELECT 
      p.id as project_id, 
      p.name as project_name,
      r.id as role_id, 
      r.name as role_name,
      r.template_config
    FROM projects p
    CROSS JOIN roles r
    WHERE LOWER(p.name) = LOWER(?) AND r.id = ?
  `).get(projectName, roleId) as {
    project_id: number;
    project_name: string;
    role_id: string;
    role_name: string;
    template_config: string;
  } | undefined;
  
  if (!result) {
    // Enhanced error with suggestions
    const suggestions = findSimilarProjects(db, projectName);
    const roleExists = db.prepare('SELECT id FROM roles WHERE id = ?').get(roleId);
    
    if (!roleExists) {
      throw new ApplicationError(
        `Role '${roleId}' not found`,
        ERROR_CODES.NOT_FOUND
      );
    }
    
    const suggestion = suggestions.length > 0 
      ? ` Did you mean: ${suggestions.slice(0, 3).join(', ')}?`
      : '';
    
    throw new ApplicationError(
      `Project '${projectName}' not found.${suggestion}`,
      ERROR_CODES.NOT_FOUND
    );
  }
  
  // OPTIMIZATION: Single transaction for role switch and logging
  const transaction = db.transaction(() => {
    // Switch active role
    db.prepare(`
      INSERT OR REPLACE INTO active_roles (project_id, system_id, role_id, activated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(result.project_id, systemId, result.role_id);
    
    // Log the switch
    db.prepare(`
      INSERT INTO update_history (entity_type, entity_id, action, changes, role_id)
      VALUES ('project', ?, 'role_switch', ?, ?)
    `).run(
      result.project_id,
      JSON.stringify({
        role_id: result.role_id,
        role_name: result.role_name,
        system_id: systemId
      }),
      result.role_id
    );
  });
  
  transaction();
  
  // OPTIMIZATION: Compressed response using ResponseFormatter
  return ResponseFormatter.roleSwitch(
    result.role_name,
    result.project_name, 
    result.role_id,
    { verbose: false }
  );
}

function findSimilarProjects(db: any, projectName: string): string[] {
  const projects = db.prepare(`
    SELECT name FROM projects 
    WHERE name LIKE ? OR name LIKE ?
    LIMIT 5
  `).all(`%${projectName}%`, `${projectName}%`) as { name: string }[];
  
  return projects.map(p => p.name);
}

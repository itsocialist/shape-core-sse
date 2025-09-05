/**
 * MCP Tool: Delete Custom Role
 * Allows users to delete their custom roles
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase } from '../db/helpers.js';
import { getCurrentSystemId } from '../db/helpers.js';
import { sanitizeInput } from '../utils/security.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';

const inputSchema = z.object({
  role_id: z.string().min(1).max(50)
});

export const deleteCustomRoleTool: Tool = {
  name: 'delete_custom_role',
  description: 'Delete a custom role that you created',
  
  inputSchema: {
    type: 'object',
    properties: {
      role_id: {
        type: 'string',
        description: 'The ID of the custom role to delete'
      }
    },
    required: ['role_id']
  }
};

export async function deleteCustomRole(input: unknown) {
  const validated = inputSchema.parse(input);
  const db = await getDatabase();
  const systemId = await getCurrentSystemId(db);
  
  const roleId = sanitizeInput(validated.role_id);
  
  // Get the role details
  const role = db.prepare(`
    SELECT id, name, is_custom, author_system_id 
    FROM roles 
    WHERE id = ?
  `).get(roleId) as { 
    id: string; 
    name: string; 
    is_custom: number; 
    author_system_id: number | null 
  } | undefined;
  
  if (!role) {
    throw new ApplicationError(
      `Role '${roleId}' not found`,
      ERROR_CODES.NOT_FOUND
    );
  }
  
  // Check if it's a custom role
  if (!role.is_custom) {
    throw new ApplicationError(
      `Cannot delete default role '${roleId}'. Only custom roles can be deleted.`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  
  // Check if the user owns this role (created on this system)
  if (role.author_system_id !== systemId) {
    throw new ApplicationError(
      `Cannot delete role '${roleId}'. You can only delete roles created on this system.`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  
  // Check if this role is currently active in any project
  const activeProjects = db.prepare(`
    SELECT p.name 
    FROM active_roles ar
    JOIN projects p ON ar.project_id = p.id
    WHERE ar.role_id = ? AND ar.system_id = ?
  `).all(roleId, systemId) as Array<{ name: string }>;
  
  // Get statistics about the role usage
  const stats = {
    contextEntries: db.prepare(
      'SELECT COUNT(*) as count FROM context_entries WHERE role_id = ?'
    ).get(roleId) as { count: number },
    
    projectsUsed: db.prepare(`
      SELECT COUNT(DISTINCT project_id) as count 
      FROM context_entries 
      WHERE role_id = ?
    `).get(roleId) as { count: number }
  };
  
  // Clean up references to this role before deletion
  // Note: We keep context_entries and update_history for historical purposes
  
  // 1. Remove from project_roles
  db.prepare('DELETE FROM project_roles WHERE role_id = ?').run(roleId);
  
  // 2. Remove from active_roles
  db.prepare('DELETE FROM active_roles WHERE role_id = ?').run(roleId);
  
  // 3. Remove handoffs where this role is involved
  db.prepare('DELETE FROM role_handoffs WHERE from_role_id = ? OR to_role_id = ?')
    .run(roleId, roleId);
  
  // Delete the role
  db.prepare('DELETE FROM roles WHERE id = ?').run(roleId);
  
  // Log the deletion
  db.prepare(`
    INSERT INTO update_history (entity_type, entity_id, action, changes)
    VALUES ('role', ?, 'delete', ?)
  `).run(
    roleId,
    JSON.stringify({
      role_id: roleId,
      role_name: role.name,
      deleted_by_system_id: systemId,
      stats: {
        context_entries: stats.contextEntries.count,
        projects_used: stats.projectsUsed.count
      }
    })
  );
  
  let response = `✅ Deleted custom role: ${role.name} (${roleId})\n`;
  
  if (stats.contextEntries.count > 0) {
    response += `\n📊 Role usage statistics:\n`;
    response += `   • Context entries: ${stats.contextEntries.count}\n`;
    response += `   • Projects used in: ${stats.projectsUsed.count}\n`;
    response += `\n💡 Note: Existing context entries retain their role reference for historical tracking.`;
  }
  
  if (activeProjects.length > 0) {
    response += `\n\n⚠️  This role was active in the following projects:\n`;
    activeProjects.forEach(p => {
      response += `   • ${p.name}\n`;
    });
    response += `\nPlease switch to another role in these projects.`;
  }
  
  return response;
}

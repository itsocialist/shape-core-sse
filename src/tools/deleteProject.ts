/**
 * Delete a project and all associated data (HARD DELETE)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { DatabaseManager } from '../db/database.js';
import { sanitizeInput } from '../utils/security.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';

const inputSchema = z.object({
  project_name: z.string().min(1).max(255),
  confirm: z.boolean()
});

export function createDeleteProjectTool(db: DatabaseManager): Tool {
  return {
    name: 'delete_project',
    description: 'Delete a project and all associated data (requires confirmation)',
    inputSchema: {
      type: 'object',
      properties: {
        project_name: {
          type: 'string',
          description: 'The name of the project to delete'
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm deletion'
        }
      },
      required: ['project_name', 'confirm']
    }
  };
}

export async function deleteProject(db: DatabaseManager, input: unknown): Promise<string> {
  const validated = inputSchema.parse(input);
  
  if (!validated.confirm) {
    throw new ApplicationError(
      'Deletion confirmation required. Set confirm: true to proceed.',
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  
  const projectName = sanitizeInput(validated.project_name);
  
  // Get project
  const project = db.getProject(projectName);
  
  if (!project) {
    throw new ApplicationError(
      `Project '${projectName}' not found`,
      ERROR_CODES.NOT_FOUND
    );
  }
  
  // Get the raw database for queries
  const rawDb = (db as any).db;
  const system = db.getCurrentSystem();
  const systemId = system?.id || 1;
  
  // Check for active roles
  const activeRoleCheck = rawDb.prepare(`
    SELECT COUNT(*) as count 
    FROM active_roles
    WHERE project_id = ?
  `).get(project.id) as { count: number };
  
  if (activeRoleCheck.count > 0) {
    throw new ApplicationError(
      `Cannot delete project with active roles. Please switch roles first.`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  
  // Perform HARD delete with cascade
  const result = rawDb.transaction(() => {
      // Count items before deletion for summary
      const contextCount = rawDb.prepare(
        'SELECT COUNT(*) as count FROM context_entries WHERE project_id = ?'
      ).get(project.id) as { count: number };
      
      const roleCount = rawDb.prepare(
        'SELECT COUNT(*) as count FROM project_roles WHERE project_id = ?'
      ).get(project.id) as { count: number };
      
      const handoffCount = rawDb.prepare(
        'SELECT COUNT(*) as count FROM role_handoffs WHERE project_id = ?'
      ).get(project.id) as { count: number };
      
      // Delete from context_search first (FTS5 table)
      rawDb.prepare(`
        DELETE FROM context_search 
        WHERE entity_id IN (
          SELECT id FROM context_entries WHERE project_id = ?
        ) AND entity_type = 'context'
      `).run(project.id);
      
      // Delete all related data
      rawDb.prepare('DELETE FROM role_handoffs WHERE project_id = ?').run(project.id);
      rawDb.prepare('DELETE FROM active_roles WHERE project_id = ?').run(project.id);
      rawDb.prepare('DELETE FROM project_roles WHERE project_id = ?').run(project.id);
      rawDb.prepare('DELETE FROM context_entries WHERE project_id = ?').run(project.id);
      
      // Delete the project itself
      rawDb.prepare('DELETE FROM projects WHERE id = ?').run(project.id);
      
      // Log deletion
      rawDb.prepare(`
        INSERT INTO update_history (entity_type, entity_id, action, changes)
        VALUES ('project', ?, 'hard_delete', ?)
      `).run(
        project.id,
        JSON.stringify({
          project_name: projectName,
          contexts_deleted: contextCount.count,
          roles_deleted: roleCount.count,
          handoffs_deleted: handoffCount.count,
          deleted_by: systemId,
          deletion_type: 'permanent'
        })
      );
      
      return {
        contextsDeleted: contextCount.count,
        rolesDeleted: roleCount.count,
        handoffsDeleted: handoffCount.count
      };
    })();
    
    return `✅ Project '${projectName}' permanently deleted

Deletion Summary:
- Contexts deleted: ${result.contextsDeleted}
- Role assignments deleted: ${result.rolesDeleted}
- Handoffs deleted: ${result.handoffsDeleted}

⚠️  This deletion is permanent and cannot be undone.`;
}
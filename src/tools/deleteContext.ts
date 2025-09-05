/**
 * Delete a specific context entry (HARD DELETE)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { DatabaseManager } from '../db/database.js';
import { sanitizeInput } from '../utils/security.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';

const inputSchema = z.object({
  context_key: z.string().min(1).max(255),
  project_name: z.string().min(1).max(255).optional()
});

export function createDeleteContextTool(db: DatabaseManager): Tool {
  return {
    name: 'delete_context',
    description: 'Delete a specific context entry from a project',
    inputSchema: {
      type: 'object',
      properties: {
        context_key: {
          type: 'string',
          description: 'The key of the context entry to delete'
        },
        project_name: {
          type: 'string',
          description: 'Optional project name to scope the deletion'
        }
      },
      required: ['context_key']
    }
  };
}

export async function deleteContext(db: DatabaseManager, input: unknown): Promise<string> {
  const validated = inputSchema.parse(input);
    
    const contextKey = sanitizeInput(validated.context_key);
    const projectName = validated.project_name ? sanitizeInput(validated.project_name) : null;
    
    // Get the raw database for queries
    const rawDb = (db as any).db;
    const system = db.getCurrentSystem();
    const systemId = system?.id || 1;
    
    let query = `
      SELECT ce.id, ce.key, p.name as project_name, p.id as project_id
      FROM context_entries ce
      LEFT JOIN projects p ON ce.project_id = p.id
      WHERE ce.key = ?
    `;
    const params: any[] = [contextKey];
    
    if (projectName) {
      query += ' AND p.name = ?';
      params.push(projectName);
    }
    
    const context = rawDb.prepare(query).get(...params) as {
      id: number;
      key: string;
      project_name: string | null;
      project_id: number | null;
    } | undefined;
    
    if (!context) {
      throw new ApplicationError(
        `Context entry '${contextKey}' not found${projectName ? ` in project '${projectName}'` : ''}`,
        ERROR_CODES.NOT_FOUND
      );
    }
    
    // Perform HARD delete
    rawDb.transaction(() => {
      // Delete from context_search first (FTS5 table)
      rawDb.prepare(`
        DELETE FROM context_search 
        WHERE entity_id = ? AND entity_type = 'context'
      `).run(context.id);
      
      // Delete the context entry
      rawDb.prepare('DELETE FROM context_entries WHERE id = ?').run(context.id);
      
      // Log deletion
      rawDb.prepare(`
        INSERT INTO update_history (entity_type, entity_id, action, changes)
        VALUES ('context', ?, 'hard_delete', ?)
      `).run(
        context.id,
        JSON.stringify({
          context_key: contextKey,
          project_name: context.project_name,
          deleted_by: systemId,
          deletion_type: 'permanent'
        })
      );
    })();
    
  return `✅ Context entry '${contextKey}' permanently deleted${context.project_name ? ` from project '${context.project_name}'` : ''}

⚠️  This deletion is permanent and cannot be undone.`;
}
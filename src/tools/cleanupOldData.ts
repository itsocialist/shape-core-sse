/**
 * Cleanup old data based on last update time (HARD DELETE)
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { DatabaseManager } from '../db/database.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';

const inputSchema = z.object({
  older_than: z.string().regex(/^\d+\s+(days?|months?|years?)$/),
  dry_run: z.boolean().default(true)
});

export function createCleanupOldDataTool(db: DatabaseManager): Tool {
  return {
    name: 'cleanup_old_data',
    description: 'Delete data older than specified time period (dry run by default)',
    inputSchema: {
      type: 'object',
      properties: {
        older_than: {
          type: 'string',
          description: 'Time period (e.g., "30 days", "6 months", "1 year")'
        },
        dry_run: {
          type: 'boolean',
          description: 'If true, only show what would be deleted without actually deleting',
          default: true
        }
      },
      required: ['older_than']
    }
  };
}

export async function cleanupOldData(db: DatabaseManager, input: unknown): Promise<string> {
  const validated = inputSchema.parse(input);
    
    // Parse time period
    const match = validated.older_than.match(/^(\d+)\s+(days?|months?|years?)$/);
    if (!match) {
      throw new ApplicationError(
        'Invalid time period format. Use format like "30 days" or "6 months"',
        ERROR_CODES.VALIDATION_ERROR
      );
    }
    
    const [, amount, unit] = match;
    const multiplier = unit.startsWith('day') ? 1 : 
                      unit.startsWith('month') ? 30 : 
                      365; // year
    const days = parseInt(amount) * multiplier;
    
    // Get the raw database for queries
    const rawDb = (db as any).db;
    const system = db.getCurrentSystem();
    const systemId = system?.id || 1;
    
    // Find old projects
    const oldProjects = rawDb.prepare(`
      SELECT id, name, updated_at,
             (SELECT COUNT(*) FROM context_entries WHERE project_id = p.id) as context_count
      FROM projects p
      WHERE datetime(updated_at) < datetime('now', '-${days} days')
        AND status != 'active'
      ORDER BY updated_at ASC
    `).all() as Array<{
      id: number;
      name: string;
      updated_at: string;
      context_count: number;
    }>;
    
    // Find old standalone contexts
    const oldContexts = rawDb.prepare(`
      SELECT id, key, type, updated_at
      FROM context_entries
      WHERE project_id IS NULL
        AND datetime(updated_at) < datetime('now', '-${days} days')
      ORDER BY updated_at ASC
    `).all() as Array<{
      id: number;
      key: string;
      type: string;
      updated_at: string;
    }>;
    
    if (validated.dry_run) {
      let report = `🔍 Cleanup Report (Dry Run)\n\n`;
      report += `Would delete data older than ${validated.older_than}:\n\n`;
      
      if (oldProjects.length > 0) {
        report += `📁 Projects (${oldProjects.length}):\n`;
        oldProjects.forEach(p => {
          const lastUpdate = new Date(p.updated_at).toLocaleDateString();
          report += `  - ${p.name} (${p.context_count} contexts, last updated: ${lastUpdate})\n`;
        });
        report += '\n';
      }
      
      if (oldContexts.length > 0) {
        report += `📝 Standalone Contexts (${oldContexts.length}):\n`;
        oldContexts.forEach(c => {
          const lastUpdate = new Date(c.updated_at).toLocaleDateString();
          report += `  - ${c.key} (${c.type}, last updated: ${lastUpdate})\n`;
        });
      }
      
      if (oldProjects.length === 0 && oldContexts.length === 0) {
        report += 'No data found matching criteria.';
      } else {
        report += `\nTo perform actual deletion, run again with dry_run: false`;
      }
      
      return report;
    }
    
    // Perform actual HARD cleanup
    let projectsDeleted = 0;
    let contextsDeleted = 0;
    let totalContextsDeleted = 0;
    
    rawDb.transaction(() => {
      // Delete old projects and their contexts
      for (const project of oldProjects) {
        // Delete from context_search first (FTS5 entries for contexts)
        rawDb.prepare(`
          DELETE FROM context_search 
          WHERE entity_id IN (
            SELECT id FROM context_entries WHERE project_id = ?
          ) AND entity_type = 'context'
        `).run(project.id);
        
        // Delete related data
        rawDb.prepare('DELETE FROM role_handoffs WHERE project_id = ?').run(project.id);
        rawDb.prepare('DELETE FROM active_roles WHERE project_id = ?').run(project.id);
        rawDb.prepare('DELETE FROM project_roles WHERE project_id = ?').run(project.id);
        
        // Count and delete contexts
        const contextsInProject = rawDb.prepare(
          'SELECT COUNT(*) as count FROM context_entries WHERE project_id = ?'
        ).get(project.id) as { count: number };
        
        rawDb.prepare('DELETE FROM context_entries WHERE project_id = ?').run(project.id);
        totalContextsDeleted += contextsInProject.count;
        
        // Delete the project
        rawDb.prepare('DELETE FROM projects WHERE id = ?').run(project.id);
        projectsDeleted++;
      }
      
      // Delete old standalone contexts
      for (const context of oldContexts) {
        rawDb.prepare('DELETE FROM context_entries WHERE id = ?').run(context.id);
        contextsDeleted++;
      }
      
      // Log cleanup
      if (projectsDeleted > 0 || contextsDeleted > 0) {
        rawDb.prepare(`
          INSERT INTO update_history (entity_type, entity_id, action, changes)
          VALUES ('system', ?, 'cleanup_hard_delete', ?)
        `).run(
          systemId,
          JSON.stringify({
            older_than: validated.older_than,
            projects_deleted: projectsDeleted,
            contexts_deleted: contextsDeleted,
            total_contexts_deleted: totalContextsDeleted + contextsDeleted,
            deleted_by: systemId,
            deletion_type: 'permanent'
          })
        );
      }
    })();
    
  return `✅ Cleanup Complete (Permanent Deletion)

Deleted:
- Projects: ${projectsDeleted}
- Standalone contexts: ${contextsDeleted}
- Total contexts: ${totalContextsDeleted + contextsDeleted}

⚠️  This deletion is permanent and cannot be undone.`;
}
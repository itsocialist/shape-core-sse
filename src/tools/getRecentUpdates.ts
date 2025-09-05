/**
 * MCP Tool: Get Recent Updates
 * Show recent changes across all projects
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { DatabaseManager } from '../db/database.js';
import { getRecentUpdatesSchema } from '../types/schemas.js';

export function createGetRecentUpdatesTool(db: DatabaseManager): Tool {
  return {
    name: 'get_recent_updates',
    description: 'Show recent updates across all projects and contexts',
    
    inputSchema: {
      type: 'object',
      properties: {
        since: {
          type: 'string',
          description: 'Time period (e.g., "-1 day", "-1 week", "-1 hour")',
          default: '-1 day'
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of updates to show',
          default: 50,
          minimum: 1,
          maximum: 100
        }
      }
    }
  };
}

export async function handleGetRecentUpdates(
  db: DatabaseManager,
  input: unknown
): Promise<string> {
  const validated = getRecentUpdatesSchema.parse(input);
  
  try {
    const updates = db.getRecentUpdates(validated.since, validated.limit);
    
    if (updates.length === 0) {
      return `📭 No updates found since ${validated.since}.`;
    }
    
    const parts = [`📋 Recent Updates (${updates.length} changes since ${validated.since}):`];
    
    // Group updates by date
    const byDate = updates.reduce((acc, update) => {
      const date = new Date(update.timestamp).toLocaleDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(update);
      return acc;
    }, {} as Record<string, typeof updates>);
    
    // Cache for entity names
    const entityCache = new Map<string, string>();
    const projects = db.listProjects(true);
    
    for (const [date, dateUpdates] of Object.entries(byDate)) {
      parts.push(`\n📅 ${date}:`);
      
      for (const update of dateUpdates) {
        const time = new Date(update.timestamp).toLocaleTimeString();
        let entityName = entityCache.get(`${update.entity_type}-${update.entity_id}`);
        
        if (!entityName) {
          if (update.entity_type === 'project') {
            const project = projects.find(p => p.id === update.entity_id);
            entityName = project?.name || 'Unknown Project';
          } else if (update.entity_type === 'context') {
            // Try to get context entry details from details
            const details = update.details as any;
            entityName = details?.key || 'Context Entry';
          } else {
            entityName = 'System';
          }
          entityCache.set(`${update.entity_type}-${update.entity_id}`, entityName || '');
        }
        
        const icon = getActionIcon(update.action);
        const typeIcon = getEntityTypeIcon(update.entity_type);
        
        parts.push(`  ${time} ${icon} ${typeIcon} ${entityName}`);
        
        // Show what changed
        if ((update.action === 'upsert' || update.action === 'update') && update.details) {
          const details = update.details as any;
          const detailsList: string[] = [];
          
          if (update.entity_type === 'project') {
            if (details.status) detailsList.push(`status: ${details.status}`);
            if (details.repository_url) detailsList.push('added repository');
            if (details.local_directory) detailsList.push('added directory');
            if (details.description) detailsList.push('updated description');
          } else if (update.entity_type === 'context') {
            if (details.type) detailsList.push(`type: ${details.type}`);
            if (details.value && details.value.length <= 50) {
              detailsList.push(`"${details.value}"`);
            } else if (details.value) {
              detailsList.push(`"${details.value.substring(0, 47)}..."`);
            }
          }
          
          if (detailsList.length > 0) {
            parts.push(`       → ${detailsList.join(', ')}`);
          }
        }
      }
    }
    
    // Summary statistics
    const stats = updates.reduce((acc, update) => {
      acc[update.entity_type] = (acc[update.entity_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const statParts: string[] = [];
    if (stats.project) statParts.push(`${stats.project} project updates`);
    if (stats.context_entry) statParts.push(`${stats.context_entry} context updates`);
    if (stats.system) statParts.push(`${stats.system} system updates`);
    
    parts.push(`\n📊 Summary: ${statParts.join(', ')}`);
    
    return parts.join('\n');
  } catch (error) {
    throw new Error(`Failed to get recent updates: ${(error as Error).message}`);
  }
}

function getActionIcon(action: string): string {
  const icons: Record<string, string> = {
    create: '➕',
    update: '✏️',
    upsert: '💾',
    delete: '🗑️'
  };
  return icons[action] || '📝';
}

function getEntityTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    project: '📁',
    context_entry: '📄',
    system: '💻'
  };
  return icons[type] || '📌';
}

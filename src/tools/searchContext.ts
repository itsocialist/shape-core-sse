/**
 * MCP Tool: Search Context
 * Flexible search across all context entries
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { DatabaseManager } from '../db/database.js';
import { searchContextSchema } from '../types/schemas.js';
import type { SearchContextInput, ContextEntry } from '../types/index.js';

export function createSearchContextTool(db: DatabaseManager): Tool {
  return {
    name: 'search_context',
    description: 'Search for context entries across projects with flexible filters',
    
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Full-text search query'
        },
        project_name: {
          type: 'string',
          description: 'Filter by project name (omit for all projects)'
        },
        type: {
          type: 'string',
          enum: ['decision', 'code', 'standard', 'status', 'todo', 'note', 'config', 'issue', 'reference'],
          description: 'Filter by context type'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by tags (OR operation)'
        },
        since: {
          type: 'string',
          description: 'Time filter (e.g., "-1 day", "-1 week", "-1 hour")',
          default: null
        },
        limit: {
          type: 'integer',
          description: 'Maximum results to return',
          default: 20,
          minimum: 1,
          maximum: 100
        }
      }
    }
  };
}

export async function handleSearchContext(
  db: DatabaseManager,
  input: unknown
): Promise<string> {
  const validated = searchContextSchema.parse(input) as SearchContextInput;
  
  try {
    // Convert project name to ID if provided
    let projectId: number | null | undefined;
    if (validated.project_name !== undefined) {
      if (validated.project_name === '') {
        projectId = null; // Search shared contexts
      } else {
        const project = db.getProject(validated.project_name);
        if (!project) {
          return `❌ Project '${validated.project_name}' not found.`;
        }
        projectId = project.id;
      }
    }
    
    const startTime = Date.now();
    const results = db.searchContext({
      query: validated.query,
      projectId,
      type: validated.type,
      tags: validated.tags,
      since: validated.since,
      limit: validated.limit
    });
    const searchTime = Date.now() - startTime;
    
    if (results.length === 0) {
      return '🔍 No matching context entries found.';
    }
    
    const parts = [`🔍 Found ${results.length} context entries (${searchTime}ms):\\n`];
    
    // Group results by project for better readability
    const grouped = groupByProject(results, db);
    
    for (const [projectName, entries] of Object.entries(grouped)) {
      parts.push(`\\n📁 ${projectName}:`);
      
      for (const entry of entries) {
        const tags = entry.tags && entry.tags.length > 0 
          ? ` [${entry.tags.join(', ')}]` 
          : '';
        
        const systemNote = entry.is_system_specific && entry.system_id
          ? ' 💻' 
          : '';
        
        const timestamp = new Date(entry.updated_at).toLocaleString();
        
        // Format based on content length
        if (entry.value.length <= 80) {
          parts.push(`  • ${entry.type}: ${entry.key}${systemNote}${tags}`);
          parts.push(`    → ${entry.value}`);
          parts.push(`    📅 ${timestamp}`);
        } else {
          parts.push(`  • ${entry.type}: ${entry.key}${systemNote}${tags}`);
          parts.push(`    → ${entry.value.substring(0, 77)}...`);
          parts.push(`    📅 ${timestamp}`);
        }
      }
    }
    
    // Add search criteria summary
    const criteria: string[] = [];
    if (validated.query) criteria.push(`query: "${validated.query}"`);
    if (validated.type) criteria.push(`type: ${validated.type}`);
    if (validated.tags) criteria.push(`tags: ${validated.tags.join(', ')}`);
    if (validated.since) criteria.push(`since: ${validated.since}`);
    
    if (criteria.length > 0) {
      parts.push(`\\n🔎 Search criteria: ${criteria.join(', ')}`);
    }
    
    return parts.join('\\n');
  } catch (error) {
    throw new Error(`Search failed: ${(error as Error).message}`);
  }
}

function groupByProject(
  entries: ContextEntry[], 
  db: DatabaseManager
): Record<string, ContextEntry[]> {
  const grouped: Record<string, ContextEntry[]> = {};
  const projectCache: Map<number, string> = new Map();
  
  for (const entry of entries) {
    let projectName: string;
    
    if (entry.project_id === null) {
      projectName = '🌐 Shared Context';
    } else {
      if (!projectCache.has(entry.project_id)) {
        const projects = db.listProjects(true);
        const project = projects.find(p => p.id === entry.project_id);
        projectCache.set(entry.project_id, project?.name || 'Unknown Project');
      }
      projectName = projectCache.get(entry.project_id)!;
    }
    
    if (!grouped[projectName]) {
      grouped[projectName] = [];
    }
    grouped[projectName].push(entry);
  }
  
  return grouped;
}

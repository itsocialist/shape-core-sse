/**
 * MCP Tool: Get Project Context
 * Retrieve all context for a specific project
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { DatabaseManager } from '../db/database.js';
import { getProjectContextSchema } from '../types/schemas.js';
import type { GetProjectContextInput } from '../types/index.js';

export function createGetProjectContextTool(db: DatabaseManager): Tool {
  return {
    name: 'get_project_context',
    description: 'Retrieve all context entries for a specific project',
    
    inputSchema: {
      type: 'object',
      properties: {
        project_name: {
          type: 'string',
          description: 'Project name (empty string for shared context)'
        },
        system_specific: {
          type: 'boolean',
          description: 'Only show context relevant to current system',
          default: false
        }
      },
      required: ['project_name']
    }
  };
}

export async function handleGetProjectContext(
  db: DatabaseManager,
  input: unknown
): Promise<string> {
  const validated = getProjectContextSchema.parse(input) as GetProjectContextInput;
  
  try {
    // Handle shared context request
    if (validated.project_name === '') {
      const sharedEntries = db.getSharedContext();
      return formatContextEntries('🌐 Shared Context', sharedEntries, db);
    }
    
    // Get project
    const project = db.getProject(validated.project_name);
    if (!project) {
      return `❌ Project '${validated.project_name}' not found.`;
    }
    
    // Get project info
    const parts: string[] = [`📁 Project: ${project.name}`];
    
    if (project.description) {
      parts.push(`📝 Description: ${project.description}`);
    }
    
    parts.push(`📊 Status: ${project.status}`);
    
    if (project.repository_url) {
      parts.push(`📦 Repository: ${project.repository_url}`);
    }
    
    if (project.local_directory) {
      parts.push(`💾 Local directory: ${project.local_directory}`);
    }
    
    if (project.tags && project.tags.length > 0) {
      parts.push(`🏷️  Tags: ${project.tags.join(', ')}`);
    }
    
    // Get primary system info
    if (project.primary_system_id) {
      const systems = db.listProjects(true); // This gets all systems info
      const currentSystem = db.getCurrentSystem();
      parts.push(`💻 Primary system: ${currentSystem?.id === project.primary_system_id ? 'This system' : 'Another system'}`);
    }
    
    parts.push(`📅 Created: ${new Date(project.created_at).toLocaleString()}`);
    parts.push(`📅 Last updated: ${new Date(project.updated_at).toLocaleString()}`);
    parts.push(`📅 Last accessed: ${new Date(project.last_accessed).toLocaleString()}`);
    
    // Get context entries
    const entries = db.getProjectContext(project.id);
    
    if (entries.length === 0) {
      parts.push('\\n📭 No context entries stored for this project.');
    } else {
      parts.push(`\\n📚 Context Entries (${entries.length}):`);
      
      // Group by type
      const byType = entries.reduce((acc: Record<string, typeof entries>, entry) => {
        if (!acc[entry.type]) acc[entry.type] = [];
        acc[entry.type].push(entry);
        return acc;
      }, {} as Record<string, typeof entries>);
      
      // Display by type
      for (const [type, typeEntries] of Object.entries(byType)) {
        parts.push(`\\n${getTypeEmoji(type)} ${type.toUpperCase()} (${(typeEntries as any[]).length}):`);
        
        for (const entry of (typeEntries as any[])) {
          const systemNote = entry.is_system_specific ? ' 💻' : '';
          const tags = entry.tags && entry.tags.length > 0 
            ? ` [${entry.tags.join(', ')}]` 
            : '';
          
          parts.push(`  • ${entry.key}${systemNote}${tags}`);
          
          // Format value based on length
          if (entry.value.length <= 100) {
            parts.push(`    → ${entry.value}`);
          } else {
            // For longer values, show first few lines
            const lines = entry.value.split('\\n');
            if (lines.length > 3) {
              parts.push(`    → ${lines.slice(0, 3).join('\\n    → ')}`);
              parts.push(`    → ... (${lines.length - 3} more lines)`);
            } else {
              parts.push(`    → ${entry.value.substring(0, 97)}...`);
            }
          }
          
          parts.push(`    📅 Updated: ${new Date(entry.updated_at).toLocaleString()}`);
        }
      }
    }
    
    // Get recent updates
    const recentUpdates = db.getRecentUpdates('-7 days', 10);
    const projectUpdates = recentUpdates.filter(
      u => u.entity_type === 'project' && u.entity_id === project.id ||
          u.entity_type === 'context' && entries.some(e => e.id === u.entity_id)
    );
    
    if (projectUpdates.length > 0) {
      parts.push(`\\n📋 Recent Activity (last 7 days):`);
      for (const update of projectUpdates.slice(0, 5)) {
        const time = new Date(update.timestamp).toLocaleString();
        parts.push(`  • ${update.action} ${update.entity_type} - ${time}`);
      }
    }
    
    return parts.join('\\n');
  } catch (error) {
    throw new Error(`Failed to get project context: ${(error as Error).message}`);
  }
}

function formatContextEntries(title: string, entries: any[], db: DatabaseManager): string {
  const parts = [title];
  
  if (entries.length === 0) {
    parts.push('📭 No shared context entries found.');
    return parts.join('\\n');
  }
  
  parts.push(`📚 Entries (${entries.length}):`);
  
  // Group by type
  const byType = entries.reduce((acc, entry) => {
    if (!acc[entry.type]) acc[entry.type] = [];
    acc[entry.type].push(entry);
    return acc;
  }, {} as Record<string, typeof entries>);
  
  for (const [type, typeEntries] of Object.entries(byType)) {
    parts.push(`\\n${getTypeEmoji(type)} ${type.toUpperCase()} (${(typeEntries as any[]).length}):`);
    
    for (const entry of (typeEntries as any[])) {
      const systemNote = entry.is_system_specific ? ' 💻' : '';
      const tags = entry.tags && entry.tags.length > 0 
        ? ` [${entry.tags.join(', ')}]` 
        : '';
      
      parts.push(`  • ${entry.key}${systemNote}${tags}`);
      parts.push(`    → ${entry.value.length > 100 ? entry.value.substring(0, 97) + '...' : entry.value}`);
    }
  }
  
  return parts.join('\\n');
}

function getTypeEmoji(type: string): string {
  const emojis: Record<string, string> = {
    decision: '🎯',
    code: '💻',
    standard: '📐',
    status: '📊',
    todo: '✅',
    note: '📝',
    config: '⚙️',
    issue: '🐛',
    reference: '🔗'
  };
  return emojis[type] || '📌';
}

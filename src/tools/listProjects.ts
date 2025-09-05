/**
 * MCP Tool: List Projects
 * List all projects with summary information
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { DatabaseManager } from '../db/database.js';
import { listProjectsSchema } from '../types/schemas.js';

export function createListProjectsTool(db: DatabaseManager): Tool {
  return {
    name: 'list_projects',
    description: 'List all projects with their current status and summary information',
    
    inputSchema: {
      type: 'object',
      properties: {
        include_archived: {
          type: 'boolean',
          description: 'Include archived projects',
          default: false
        }
      }
    }
  };
}

export async function handleListProjects(
  db: DatabaseManager,
  input: unknown
): Promise<string> {
  const validated = listProjectsSchema.parse(input);
  
  try {
    const projects = db.listProjects(validated.include_archived);
    
    if (projects.length === 0) {
      return '📭 No projects found. Create one using store_project_context.';
    }
    
    const currentSystem = db.getCurrentSystem();
    const parts = [`📚 Projects (${projects.length}):`];
    
    // Group by status
    const byStatus = projects.reduce((acc, project) => {
      if (!acc[project.status]) acc[project.status] = [];
      acc[project.status].push(project);
      return acc;
    }, {} as Record<string, typeof projects>);
    
    // Display in order: active, paused, completed, archived
    const statusOrder = ['active', 'paused', 'completed', 'archived'];
    
    for (const status of statusOrder) {
      const statusProjects = byStatus[status];
      if (!statusProjects || statusProjects.length === 0) continue;
      
      parts.push(`\\n${getStatusEmoji(status)} ${status.toUpperCase()} (${statusProjects.length}):`);
      
      for (const project of statusProjects) {
        parts.push(`\\n  📁 ${project.name}`);
        
        if (project.description) {
          parts.push(`     ${project.description}`);
        }
        
        const details: string[] = [];
        
        if (project.repository_url) {
          details.push(`📦 Repo`);
        }
        
        if (project.local_directory) {
          details.push(`💾 Local`);
        }
        
        if (project.primary_system_id === currentSystem?.id) {
          details.push(`💻 This system`);
        } else if (project.primary_system_id) {
          details.push(`💻 Other system`);
        }
        
        if (project.tags && project.tags.length > 0) {
          details.push(`🏷️  ${project.tags.join(', ')}`);
        }
        
        if (details.length > 0) {
          parts.push(`     ${details.join(' | ')}`);
        }
        
        // Show activity
        const lastAccessed = new Date(project.last_accessed);
        const daysAgo = Math.floor((Date.now() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysAgo === 0) {
          parts.push(`     📅 Accessed today`);
        } else if (daysAgo === 1) {
          parts.push(`     📅 Accessed yesterday`);
        } else if (daysAgo < 7) {
          parts.push(`     📅 Accessed ${daysAgo} days ago`);
        } else if (daysAgo < 30) {
          parts.push(`     📅 Accessed ${Math.floor(daysAgo / 7)} weeks ago`);
        } else {
          parts.push(`     📅 Accessed ${Math.floor(daysAgo / 30)} months ago`);
        }
      }
    }
    
    // Summary stats
    const stats: string[] = [];
    if (byStatus.active) stats.push(`${byStatus.active.length} active`);
    if (byStatus.paused) stats.push(`${byStatus.paused.length} paused`);
    if (byStatus.completed) stats.push(`${byStatus.completed.length} completed`);
    if (byStatus.archived) stats.push(`${byStatus.archived.length} archived`);
    
    parts.push(`\\n📊 Summary: ${stats.join(', ')}`);
    
    if (currentSystem) {
      const systemProjects = projects.filter(p => p.primary_system_id === currentSystem.id);
      parts.push(`💻 ${systemProjects.length} projects on this system (${currentSystem.name})`);
    }
    
    return parts.join('\\n');
  } catch (error) {
    throw new Error(`Failed to list projects: ${(error as Error).message}`);
  }
}

function getStatusEmoji(status: string): string {
  const emojis: Record<string, string> = {
    active: '🟢',
    paused: '🟡',
    completed: '✅',
    archived: '📦'
  };
  return emojis[status] || '⚪';
}

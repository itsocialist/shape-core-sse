/**
 * MCP Tool: Update Project Status
 * Quick way to update project status with optional note
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { DatabaseManager } from '../db/database.js';
import { updateProjectStatusSchema } from '../types/schemas.js';
import type { UpdateProjectStatusInput } from '../types/index.js';

export function createUpdateProjectStatusTool(db: DatabaseManager): Tool {
  return {
    name: 'update_project_status',
    description: 'Update the status of a project (active, paused, completed, archived)',
    
    inputSchema: {
      type: 'object',
      properties: {
        project_name: {
          type: 'string',
          description: 'Name of the project to update'
        },
        status: {
          type: 'string',
          enum: ['active', 'paused', 'completed', 'archived'],
          description: 'New status for the project'
        },
        note: {
          type: 'string',
          description: 'Optional note about the status change'
        }
      },
      required: ['project_name', 'status']
    }
  };
}

export async function handleUpdateProjectStatus(
  db: DatabaseManager,
  input: unknown
): Promise<string> {
  const validated = updateProjectStatusSchema.parse(input) as UpdateProjectStatusInput;
  
  try {
    // Check if project exists
    const project = db.getProject(validated.project_name);
    if (!project) {
      return `❌ Project '${validated.project_name}' not found.`;
    }
    
    const oldStatus = project.status;
    
    // Update project status
    db.upsertProject({
      name: validated.project_name,
      status: validated.status
    });
    
    // Store status update as context entry
    if (validated.note) {
      db.storeContext({
        project_id: project.id,
        type: 'status',
        key: `Status changed to ${validated.status}`,
        value: validated.note,
        metadata: {
          old_status: oldStatus,
          new_status: validated.status
        }
      });
    }
    
    const parts = [
      `✅ Project '${validated.project_name}' status updated`,
      `📊 ${oldStatus} → ${validated.status}`
    ];
    
    if (validated.note) {
      parts.push(`📝 Note: ${validated.note}`);
    }
    
    // Add status-specific messages
    switch (validated.status) {
      case 'completed':
        parts.push('🎉 Congratulations on completing the project!');
        break;
      case 'archived':
        parts.push('📦 Project archived. Use include_archived=true in list_projects to see it.');
        break;
      case 'paused':
        parts.push('⏸️  Project paused. Remember to set it back to active when ready.');
        break;
      case 'active':
        parts.push('🚀 Project is now active!');
        break;
    }
    
    return parts.join('\n');
  } catch (error) {
    throw new Error(`Failed to update project status: ${(error as Error).message}`);
  }
}

/**
 * MCP Tool: Get Project Context (with role support)
 * Retrieve all context for a specific project with role grouping
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase } from '../db/helpers.js';
import { getCurrentSystemId, sanitizeInput } from '../utils/security.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';

const inputSchema = z.object({
  project_name: z.string().min(0).max(255),
  system_specific: z.boolean().default(false),
  role_view: z.string().optional(),
  group_by_role: z.boolean().default(false),
  include_handoffs: z.boolean().default(true),
  limit: z.number().min(1).max(1000).default(100)
});

export const getProjectContextTool: Tool = {
  name: 'get_project_context',
  description: `Retrieve all context entries for a specific project, optionally filtered by current system or role.
    
Examples:
- "Show me everything about project 'my-app'"
- "What's the context for project 'my-app' on this system?"
- "Get shared context" (use empty project_name)
- "Show project 'my-app' grouped by roles"
- "Show only architect view of project 'my-app'"`,
  
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
      },
      role_view: {
        type: 'string',
        description: 'Filter to show only a specific role\'s perspective'
      },
      group_by_role: {
        type: 'boolean',
        description: 'Group results by role',
        default: false
      },
      include_handoffs: {
        type: 'boolean',
        description: 'Include role handoffs in the context',
        default: true
      },
      limit: {
        type: 'number',
        description: 'Maximum entries per role/type',
        default: 100
      }
    },
    required: ['project_name']
  }
};

export async function getProjectContext(input: unknown) {
  const validated = inputSchema.parse(input);
  const db = await getDatabase();
  const systemId = validated.system_specific ? await getCurrentSystemId(db) : null;
  
  // Handle shared context
  if (validated.project_name === '') {
    const sharedQuery = `
      SELECT 
        ce.*,
        r.name as role_name,
        s.name as system_name
      FROM context_entries ce
      LEFT JOIN roles r ON ce.role_id = r.id
      LEFT JOIN systems s ON ce.system_id = s.id
      WHERE ce.project_id IS NULL
      ${systemId ? 'AND (ce.system_id = ? OR ce.system_id IS NULL)' : ''}
      ${validated.role_view ? 'AND ce.role_id = ?' : ''}
      ORDER BY ce.updated_at DESC
      LIMIT ?
    `;
    
    const params: any[] = [];
    if (systemId) params.push(systemId);
    if (validated.role_view) params.push(sanitizeInput(validated.role_view));
    params.push(validated.limit);
    
    const entries = db.prepare(sharedQuery).all(...params);
    return formatSharedContext(entries);
  }
  
  // Get project
  const projectName = sanitizeInput(validated.project_name);
  const project = db.prepare(
    'SELECT * FROM projects WHERE name = ?'
  ).get(projectName) as any;
  
  if (!project) {
    throw new ApplicationError(
      `Project '${projectName}' not found`,
      ERROR_CODES.NOT_FOUND
    );
  }
  
  // Build query based on options
  let contextQuery = `
    SELECT 
      ce.*,
      r.name as role_name,
      s.name as system_name
    FROM context_entries ce
    LEFT JOIN roles r ON ce.role_id = r.id
    LEFT JOIN systems s ON ce.system_id = s.id
    WHERE ce.project_id = ?
  `;
  
  const params: any[] = [project.id];
  
  if (systemId) {
    contextQuery += ' AND (ce.system_id = ? OR ce.system_id IS NULL)';
    params.push(systemId);
  }
  
  if (validated.role_view) {
    contextQuery += ' AND ce.role_id = ?';
    params.push(sanitizeInput(validated.role_view));
  }
  
  contextQuery += ' ORDER BY ce.role_id, ce.type, ce.updated_at DESC';
  
  const entries = db.prepare(contextQuery).all(...params);
  
  // Get handoffs if requested
  let handoffs: any[] = [];
  if (validated.include_handoffs) {
    const handoffQuery = `
      SELECT 
        h.*,
        fr.name as from_role_name,
        tr.name as to_role_name
      FROM role_handoffs h
      JOIN roles fr ON h.from_role_id = fr.id
      JOIN roles tr ON h.to_role_id = tr.id
      WHERE h.project_id = ?
      ${validated.role_view ? 'AND (h.from_role_id = ? OR h.to_role_id = ?)' : ''}
      ORDER BY h.created_at DESC
      LIMIT 20
    `;
    
    const handoffParams = [project.id];
    if (validated.role_view) {
      const roleId = sanitizeInput(validated.role_view);
      handoffParams.push(roleId, roleId);
    }
    
    handoffs = db.prepare(handoffQuery).all(...handoffParams);
  }
  
  // Get active roles for the project
  const activeRoles = db.prepare(`
    SELECT 
      ar.role_id,
      ar.system_id,
      ar.activated_at,
      r.name as role_name,
      s.name as system_name
    FROM active_roles ar
    JOIN roles r ON ar.role_id = r.id
    JOIN systems s ON ar.system_id = s.id
    WHERE ar.project_id = ?
    ORDER BY ar.activated_at DESC
  `).all(project.id);
  
  // Format based on grouping preference
  if (validated.group_by_role) {
    return formatByRole(project, entries, handoffs, activeRoles);
  } else {
    return formatChronological(project, entries, handoffs, activeRoles);
  }
}

function formatSharedContext(entries: any[]): string {
  const lines: string[] = ['🌐 Shared Context (available to all projects)'];
  lines.push(`📚 Total entries: ${entries.length}`);
  lines.push('');
  
  entries.forEach(entry => {
    const tags = JSON.parse(entry.tags || '[]');
    lines.push(`📌 ${entry.type}: ${entry.key}`);
    lines.push(`   📝 ${entry.value}`);
    if (entry.role_name) lines.push(`   👤 Role: ${entry.role_name}`);
    if (tags.length > 0) lines.push(`   🏷️  Tags: ${tags.join(', ')}`);
    if (entry.system_name) lines.push(`   💻 System: ${entry.system_name}`);
    lines.push(`   📅 Updated: ${entry.updated_at}`);
    lines.push('');
  });
  
  return lines.join('\n');
}

function formatByRole(project: any, entries: any[], handoffs: any[], activeRoles: any[]): string {
  const lines: string[] = [];
  lines.push(`📁 Project: ${project.name}`);
  lines.push(`📝 Description: ${project.description || 'No description'}`);
  lines.push(`📊 Status: ${project.status}`);
  lines.push(`📅 Last updated: ${project.updated_at}`);
  lines.push('');
  
  // Group entries by role
  const byRole: Record<string, any[]> = {};
  const noRole: any[] = [];
  
  entries.forEach(entry => {
    if (entry.role_id) {
      if (!byRole[entry.role_id]) {
        byRole[entry.role_id] = [];
      }
      byRole[entry.role_id].push(entry);
    } else {
      noRole.push(entry);
    }
  });
  
  // Active roles section
  if (activeRoles.length > 0) {
    lines.push('🎭 Active Roles:');
    activeRoles.forEach(ar => {
      lines.push(`   👤 ${ar.role_name} on ${ar.system_name} (activated: ${ar.activated_at})`);
    });
    lines.push('');
  }
  
  // Display by role
  Object.entries(byRole).forEach(([roleId, roleEntries]) => {
    const roleName = roleEntries[0].role_name || roleId;
    lines.push(`\n👤 Role: ${roleName}`);
    lines.push(`📚 Entries: ${roleEntries.length}`);
    lines.push('─'.repeat(50));
    
    // Group by type within role
    const byType: Record<string, any[]> = {};
    roleEntries.forEach(entry => {
      if (!byType[entry.type]) byType[entry.type] = [];
      byType[entry.type].push(entry);
    });
    
    Object.entries(byType).forEach(([type, typeEntries]) => {
      lines.push(`\n  📌 ${type.toUpperCase()} (${typeEntries.length}):`);
      typeEntries.slice(0, 5).forEach(entry => {
        const tags = JSON.parse(entry.tags || '[]');
        lines.push(`    • ${entry.key}`);
        lines.push(`      ${entry.value.substring(0, 100)}${entry.value.length > 100 ? '...' : ''}`);
        if (tags.length > 0) lines.push(`      🏷️  ${tags.join(', ')}`);
        lines.push(`      📅 ${entry.updated_at}`);
      });
      if (typeEntries.length > 5) {
        lines.push(`    ... and ${typeEntries.length - 5} more`);
      }
    });
  });
  
  // Entries without roles
  if (noRole.length > 0) {
    lines.push(`\n🔧 No Role Assigned (${noRole.length} entries)`);
    lines.push('─'.repeat(50));
    noRole.slice(0, 5).forEach(entry => {
      lines.push(`  • ${entry.type}: ${entry.key}`);
      lines.push(`    ${entry.value.substring(0, 80)}...`);
    });
    if (noRole.length > 5) {
      lines.push(`  ... and ${noRole.length - 5} more`);
    }
  }
  
  // Handoffs section
  if (handoffs.length > 0) {
    lines.push(`\n🤝 Role Handoffs (${handoffs.length}):`);
    lines.push('─'.repeat(50));
    handoffs.forEach(h => {
      const data = JSON.parse(h.handoff_data);
      lines.push(`  ${h.from_role_name} → ${h.to_role_name}`);
      lines.push(`  📝 ${data.summary}`);
      lines.push(`  📅 ${h.created_at}`);
      lines.push('');
    });
  }
  
  return lines.join('\n');
}

function formatChronological(project: any, entries: any[], handoffs: any[], activeRoles: any[]): string {
  const lines: string[] = [];
  lines.push(`📁 Project: ${project.name}`);
  lines.push(`📝 Description: ${project.description || 'No description'}`);
  lines.push(`📊 Status: ${project.status}`);
  if (project.repository_url) lines.push(`🔗 Repository: ${project.repository_url}`);
  if (project.local_directory) lines.push(`📂 Local: ${project.local_directory}`);
  lines.push(`📚 Total context entries: ${entries.length}`);
  lines.push(`📅 Created: ${project.created_at}`);
  lines.push(`📅 Last updated: ${project.updated_at}`);
  lines.push('');
  
  // Active roles
  if (activeRoles.length > 0) {
    lines.push('🎭 Active Roles:');
    activeRoles.forEach(ar => {
      lines.push(`   👤 ${ar.role_name} on ${ar.system_name}`);
    });
    lines.push('');
  }
  
  // Recent handoffs
  if (handoffs.length > 0) {
    lines.push(`🤝 Recent Handoffs:`);
    handoffs.slice(0, 3).forEach(h => {
      const data = JSON.parse(h.handoff_data);
      lines.push(`   ${h.from_role_name} → ${h.to_role_name}: ${data.summary}`);
    });
    lines.push('');
  }
  
  // Context entries
  lines.push('📚 Context Entries:');
  lines.push('');
  
  // Group by type for summary
  const byType: Record<string, number> = {};
  entries.forEach(entry => {
    byType[entry.type] = (byType[entry.type] || 0) + 1;
  });
  
  lines.push('Summary by type:');
  Object.entries(byType).forEach(([type, count]) => {
    lines.push(`  • ${type}: ${count}`);
  });
  lines.push('');
  
  // Show recent entries
  lines.push('Recent entries:');
  entries.slice(0, 20).forEach(entry => {
    const tags = JSON.parse(entry.tags || '[]');
    lines.push(`\n${entry.type.toUpperCase()}: ${entry.key}`);
    if (entry.role_name) lines.push(`👤 Role: ${entry.role_name}`);
    lines.push(`📝 ${entry.value}`);
    if (tags.length > 0) lines.push(`🏷️  Tags: ${tags.join(', ')}`);
    if (entry.is_system_specific && entry.system_name) {
      lines.push(`💻 System-specific to: ${entry.system_name}`);
    }
    lines.push(`📅 Updated: ${entry.updated_at}`);
  });
  
  if (entries.length > 20) {
    lines.push(`\n... and ${entries.length - 20} more entries`);
  }
  
  return lines.join('\n');
}

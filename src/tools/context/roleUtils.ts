/**
 * Role context utilities for service operations
 */

import { RoleContext } from '../../types/roles.js';
import { getDatabase } from '../../db/helpers.js';

/**
 * Get role context for service operations
 */
export async function getRoleContext(roleId: string, projectId: string): Promise<RoleContext> {
  const db = await getDatabase();
  
  // Get project info
  const project = db.prepare(
    'SELECT id, name FROM projects WHERE name = ?'
  ).get(projectId) as { id: number; name: string } | undefined;
  
  if (!project) {
    // Return minimal context for non-existent projects (for testing)
    return {
      role: roleId,
      projectId,
      context: {}
    };
  }
  
  // Get role info
  const role = db.prepare(
    'SELECT id, name, description FROM roles WHERE id = ?'
  ).get(roleId) as { id: string; name: string; description: string } | undefined;
  
  // Get recent context entries for this role and project
  const contexts = db.prepare(`
    SELECT 
      type,
      key,
      value,
      metadata
    FROM context_entries
    WHERE project_id = ? AND role_id = ?
    ORDER BY updated_at DESC
    LIMIT 20
  `).all(project.id, roleId) as Array<{
    type: string;
    key: string;
    value: string;
    metadata: string;
  }>;
  
  // Build context object from recent entries
  const contextData: Record<string, any> = {};
  
  for (const ctx of contexts) {
    try {
      const metadata = JSON.parse(ctx.metadata || '{}');
      contextData[ctx.key] = {
        type: ctx.type,
        value: ctx.value,
        ...metadata
      };
    } catch {
      contextData[ctx.key] = ctx.value;
    }
  }
  
  // Add role-specific preferences
  const preferences: Record<string, any> = {};
  if (roleId === 'devops') {
    preferences.securityFirst = true;
    preferences.monitoringEnabled = true;
  } else if (roleId === 'developer') {
    preferences.codeQuality = true;
    preferences.testCoverage = true;
  }
  
  return {
    role: roleId,
    projectId,
    context: contextData,
    preferences,
    capabilities: role ? [role.description] : []
  };
}

/**
 * Store deployment context for a role
 */
export async function storeDeploymentContext(
  roleId: string,
  projectId: string,
  deploymentData: any
): Promise<void> {
  const db = await getDatabase();
  
  // Get or create project
  let project = db.prepare(
    'SELECT id FROM projects WHERE name = ?'
  ).get(projectId) as { id: number } | undefined;
  
  if (!project) {
    const result = db.prepare(
      'INSERT INTO projects (name, status) VALUES (?, ?)'
    ).run(projectId, 'active');
    
    project = { id: result.lastInsertRowid as number };
  }
  
  // Store deployment context
  db.prepare(`
    INSERT OR REPLACE INTO context_entries (
      project_id, role_id, type, key, value, 
      is_system_specific, tags, metadata, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `).run(
    project.id,
    roleId,
    'status',
    'last_deployment',
    JSON.stringify(deploymentData),
    0,
    JSON.stringify(['deployment', 'automation']),
    JSON.stringify({ source: 'deployment_tool' })
  );
}

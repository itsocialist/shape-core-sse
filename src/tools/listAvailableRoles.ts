/**
 * MCP Tool: list_available_roles  
 * List all available roles and their capabilities
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { RoleProvider } from '../orchestration/roles/RoleProvider.js';
import { DatabaseManager } from '../db/database.js';

export function createListAvailableRolesTool(
  db: DatabaseManager,
  roleProvider: RoleProvider
): Tool {
  return {
    name: 'list_available_roles',
    description: 'List all available roles and their capabilities',
    inputSchema: {
      type: 'object',
      properties: {
        includeIntelligence: {
          type: 'boolean',
          description: 'Whether to include role intelligence details (default: false)',
          default: false
        }
      }
    }
  };
}

export async function handleListAvailableRoles(
  db: DatabaseManager,
  roleProvider: RoleProvider,
  args: any
): Promise<string> {
  const { includeIntelligence = false } = args;

  const roles = await roleProvider.getAvailableRoles();
  
  if (includeIntelligence) {
    // Get detailed intelligence for each role
    const rolesWithIntelligence = await Promise.all(
      roles.map(async (role) => {
        const intelligence = await roleProvider.getRoleIntelligence(role.id);
        return {
          ...role,
          intelligence: {
            focusAreas: intelligence.focusAreas,
            capabilities: intelligence.capabilities,
            knowledgeBase: intelligence.knowledgeBase.slice(0, 3) // First 3 items only
          }
        };
      })
    );
    
    return JSON.stringify(rolesWithIntelligence, null, 2);
  }

  return JSON.stringify(roles, null, 2);
}

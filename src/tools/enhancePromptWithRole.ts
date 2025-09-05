/**
 * MCP Tool: enhance_prompt_with_role
 * Enhance a prompt with role-specific intelligence and context
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { RoleProvider } from '../orchestration/roles/RoleProvider.js';
import { DatabaseManager } from '../db/database.js';

export function createEnhancePromptWithRoleTool(
  db: DatabaseManager,
  roleProvider: RoleProvider
): Tool {
  return {
    name: 'enhance_prompt_with_role',
    description: 'Enhance a prompt with role-specific intelligence and perspective',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Original prompt to enhance'
        },
        roleId: {
          type: 'string',
          description: 'Role to enhance prompt for (architect, developer, devops, qa, product)',
          enum: ['architect', 'developer', 'devops', 'qa', 'product']
        },
        projectName: {
          type: 'string',
          description: 'Optional project context to include'
        }
      },
      required: ['prompt', 'roleId']
    }
  };
}

export async function handleEnhancePromptWithRole(
  db: DatabaseManager,
  roleProvider: RoleProvider,
  args: any
): Promise<string> {
  const { prompt, roleId, projectName } = args;

  const enhancedPrompt = await roleProvider.enhancePrompt(
    prompt,
    roleId,
    { projectName }
  );

  return enhancedPrompt;
}

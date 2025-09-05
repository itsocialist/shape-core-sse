/**
 * MCP Tool: execute_as_role
 * Execute a service command with role-specific intelligence and context
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { RoleOrchestrator } from '../orchestration/roles/RoleOrchestrator.js';
import { ServiceRegistry } from '../orchestration/registry/ServiceRegistry.js';
import { RoleProvider } from '../orchestration/roles/RoleProvider.js';
import { DatabaseManager } from '../db/database.js';

export function createExecuteAsRoleTool(
  db: DatabaseManager,
  registry: ServiceRegistry,
  roleProvider: RoleProvider,
  orchestrator: RoleOrchestrator
): Tool {
  return {
    name: 'execute_as_role',
    description: 'Perform tasks with specialized AI role expertise and context',
    inputSchema: {
      type: 'object',
      properties: {
        roleId: {
          type: 'string',
          description: 'Role to execute as (architect, developer, devops, qa, product)',
          enum: ['architect', 'developer', 'devops', 'qa', 'product']
        },
        serviceName: {
          type: 'string',
          description: 'Name of the service to use (e.g., git, filesystem)'
        },
        tool: {
          type: 'string',
          description: 'Tool/command to execute on the service'
        },
        args: {
          type: 'object',
          description: 'Arguments for the tool'
        },
        projectName: {
          type: 'string',
          description: 'Optional project context to use'
        }
      },
      required: ['roleId', 'serviceName', 'tool', 'args']
    }
  };
}

export async function handleExecuteAsRole(
  db: DatabaseManager,
  registry: ServiceRegistry,
  roleProvider: RoleProvider,
  orchestrator: RoleOrchestrator,
  args: any
): Promise<string> {
  const { roleId, serviceName, tool, args: toolArgs, projectName } = args;

  const result = await orchestrator.executeAsRole(
    roleId,
    serviceName,
    tool,
    toolArgs,
    projectName
  );

  if (!result.success) {
    throw new Error(result.error || 'Role execution failed');
  }

  // Format the response with role context
  const response = {
    success: true,
    data: result.data,
    roleContext: {
      roleId: result.roleContext?.roleId,
      analysis: result.roleContext?.analysis,
      suggestions: result.roleContext?.suggestions,
      contextStored: result.roleContext?.contextStored
    }
  };

  return JSON.stringify(response, null, 2);
}

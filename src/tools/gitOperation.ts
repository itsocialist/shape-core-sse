/**
 * Git MCP Tool - Test-Driven Implementation
 * Exposes GitAdapter operations through MCP tool interface
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const gitOperationSchema = z.object({
  action: z.enum(['init', 'add', 'commit', 'status', 'log', 'diff', 'branch', 'checkout', 'push', 'pull']),
  args: z.record(z.any()).optional().default({}),
  repositoryPath: z.string().optional(),
  projectName: z.string().optional(),
  storeResult: z.boolean().optional().default(true)
});

export const gitOperationTool: Tool = {
  name: 'git_operation',
  description: 'Perform Git version control with context storage',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['init', 'add', 'commit', 'status', 'log', 'diff', 'branch', 'checkout', 'push', 'pull'],
        description: 'Git action to perform'
      },
      args: {
        type: 'object',
        description: 'Arguments for the Git operation',
        additionalProperties: true
      },
      repositoryPath: {
        type: 'string',
        description: 'Path to the Git repository (defaults to current working directory)'
      },
      projectName: {
        type: 'string',
        description: 'Project context to use for storing operation results'
      },
      storeResult: {
        type: 'boolean',
        description: 'Whether to store the operation result in project context',
        default: true
      }
    },
    required: ['action']
  }
};

export async function handleGitOperation(
  args: unknown,
  serviceRegistry?: any,
  db?: any
): Promise<any> {
  const validated = gitOperationSchema.parse(args);
  
  try {
    // If we have a service registry, use it (orchestrated approach)
    if (serviceRegistry) {
      const result = await serviceRegistry.execute('git', {
        tool: validated.action,
        args: validated.args,
        projectName: validated.projectName,
        storeResult: validated.storeResult
      });
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      return {
        success: true,
        action: validated.action,
        data: result.data,
        storedInContext: validated.storeResult && validated.projectName
      };
    }
    
    // Fallback: Direct GitAdapter usage
    const { GitAdapter } = await import('../adapters/GitAdapter.js') as any;
    const gitAdapter = new GitAdapter(validated.repositoryPath || process.cwd());
    
    const result = await gitAdapter.execute({
      action: validated.action,
      args: validated.args
    });
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // Store in context if requested
    if (validated.storeResult && validated.projectName && db) {
      await storeGitOperationResult(db, validated.projectName, validated.action, result.data);
    }
    
    return {
      success: true,
      action: validated.action,
      data: result.data,
      storedInContext: validated.storeResult && validated.projectName
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error),
      code: 'GIT_OPERATION_FAILED'
    };
  }
}

async function storeGitOperationResult(
  db: any,
  projectName: string,
  action: string,
  data: any
): Promise<void> {
  try {
    const contextKey = `git-${action}-${Date.now()}`;
    const contextValue = JSON.stringify({
      action,
      result: data,
      timestamp: new Date().toISOString()
    });
    
    // Store using the context system
    await db.storeContext(
      projectName,
      'code',
      contextKey,
      contextValue,
      ['git', action, 'operation'],
      false // not system-specific
    );
  } catch (error) {
    console.warn('Failed to store git operation result in context:', error);
    // Don't fail the git operation if context storage fails
  }
}

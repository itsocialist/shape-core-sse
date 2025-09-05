/**
 * Quick Git MCP tool for demonstration
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

const gitCommandSchema = z.object({
  action: z.enum(['status', 'add', 'commit', 'push', 'log']),
  args: z.record(z.any()).optional().default({}),
  repositoryPath: z.string().optional()
});

export const gitCommandTool: Tool = {
  name: 'git_command',
  description: 'Execute Git commands using our GitAdapter',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['status', 'add', 'commit', 'push', 'log'],
        description: 'Git action to perform'
      },
      args: {
        type: 'object',
        description: 'Arguments for the Git command',
        additionalProperties: true
      },
      repositoryPath: {
        type: 'string',
        description: 'Path to the Git repository'
      }
    },
    required: ['action']
  }
};

export async function handleGitCommand(args: unknown) {
  const validated = gitCommandSchema.parse(args);
  
  try {
    // Import GitAdapter
    const { GitAdapter } = await import('../adapters/GitAdapter.js') as any;
    const gitAdapter = new GitAdapter(validated.repositoryPath || process.cwd());
    
    const result = await gitAdapter.execute({
      action: validated.action,
      args: validated.args
    });
    
    return {
      success: true,
      action: validated.action,
      result: result.data,
      status: result.status
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'GIT_COMMAND_FAILED'
    };
  }
}

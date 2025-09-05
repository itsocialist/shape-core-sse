/**
 * GitAdapter - Real Git MCP Server Integration
 * Implements BaseAdapter interface for MPCM-Pro service registry
 * Supports dependency injection for testing
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { BaseAdapter, ServiceCapability, ServiceCommand, ServiceResult } from './base/types.js';

export interface GitAdapterOptions {
  repositoryPath?: string;
  mcpClient?: Client;
  mcpTransport?: StdioClientTransport;
}

export class GitAdapter implements BaseAdapter {
  private name = 'git';
  private description = 'Git version control operations via MCP server';
  private mcpClient: Client | null = null;
  private mcpTransport: StdioClientTransport | null = null;
  private repositoryPath: string;
  private isConnected = false;
  private injectedClient: boolean = false;
  
  constructor(options?: GitAdapterOptions | string) {
    // Backward compatibility - accept string as repository path
    if (typeof options === 'string') {
      this.repositoryPath = options;
    } else {
      this.repositoryPath = options?.repositoryPath || process.cwd();
      
      // Support dependency injection for testing
      if (options?.mcpClient && options?.mcpTransport) {
        this.mcpClient = options.mcpClient;
        this.mcpTransport = options.mcpTransport;
        this.injectedClient = true;
      }
    }
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description;
  }

  async initialize(): Promise<void> {
    // Lazy initialization - connect when first needed
    console.error(`🔧 Git adapter initialized for repository: ${this.repositoryPath}`);
  }

  async getCapabilities(): Promise<ServiceCapability[]> {
    return [
      { name: 'init', description: 'Initialize a new Git repository' },
      { name: 'add', description: 'Stage files for commit' },
      { name: 'commit', description: 'Commit staged changes' },
      { name: 'status', description: 'Get repository status' },
      { name: 'log', description: 'View commit history' },
      { name: 'diff', description: 'Show differences between commits/files' },
      { name: 'branch', description: 'List or manage branches' },
      { name: 'checkout', description: 'Switch branches or restore files' },
      { name: 'push', description: 'Push commits to remote repository' },
      { name: 'pull', description: 'Pull changes from remote repository' }
    ];
  }

  async execute(command: ServiceCommand): Promise<ServiceResult> {
    // Ensure we're connected
    await this.ensureConnected();

    try {
      switch (command.tool) {
        case 'init':
          return await this.initRepository(command.args);
        case 'add':
          return await this.addFiles(command.args);
        case 'commit':
          return await this.commitChanges(command.args);
        case 'status':
          return await this.getStatus(command.args);
        case 'log':
          return await this.getLog(command.args);
        case 'diff':
          return await this.getDiff(command.args);
        case 'branch':
          return await this.manageBranches(command.args);
        case 'checkout':
          return await this.checkout(command.args);
        case 'push':
          return await this.push(command.args);
        case 'pull':
          return await this.pull(command.args);
        default:
          return {
            success: false,
            error: `Unknown git tool: ${command.tool}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Git operation failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  async cleanup(): Promise<void> {
    if (this.mcpTransport && !this.injectedClient) {
      await this.mcpTransport.close();
    }
    this.mcpClient = null;
    this.mcpTransport = null;
    this.isConnected = false;
  }

  async shutdown(): Promise<void> {
    // Delegate to cleanup for backward compatibility
    await this.cleanup();
  }

  private async ensureConnected(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    // If client was injected (for testing), just mark as connected
    if (this.injectedClient && this.mcpClient) {
      this.isConnected = true;
      return;
    }

    try {
      // Create transport to Git MCP server
      this.mcpTransport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@cyanheads/git-mcp-server'],
        env: process.env as Record<string, string>
      });

      // Create and connect MCP client
      this.mcpClient = new Client({
        name: 'mpcm-pro-git-client',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await this.mcpClient.connect(this.mcpTransport);
      this.isConnected = true;

      // Set working directory for the Git MCP server
      try {
        await this.mcpClient.callTool({
          name: 'git_set_working_dir',
          arguments: { path: this.repositoryPath }
        });
        console.error(`Git working directory set to: ${this.repositoryPath}`);
      } catch (error) {
        console.error(`Failed to set git working directory: ${error}. Some operations may fail.`);
      }

    } catch (error) {
      throw new Error(`Failed to connect to Git MCP server: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Calls a tool on the Git MCP server
   */
  private async callMcpTool(toolName: string, args: any): Promise<any> {
    if (!this.mcpClient) {
      throw new Error('MCP client not connected');
    }

    try {
      const result = await this.mcpClient.callTool({ name: toolName, arguments: args });
      return result;
    } catch (error) {
      throw new Error(`MCP tool call failed for ${toolName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Parse MCP response content
   */
  private parseResponse(result: any): any {
    const content = result?.content?.[0]?.text;
    
    // If content is a string that looks like JSON, try to parse it
    if (typeof content === 'string' && content.trim().startsWith('{')) {
      try {
        return JSON.parse(content);
      } catch {
        // Not JSON, return as is
        return content;
      }
    }
    
    // If content is already an object (from mocks), return it
    if (typeof content === 'object' && content !== null) {
      return content;
    }
    
    return content || '';
  }

  private async initRepository(args: any): Promise<ServiceResult> {
    const path = args?.path || this.repositoryPath;
    
    try {
      const result = await this.callMcpTool('git_init', { 
        repository: path 
      });
      
      // Parse response
      const data = this.parseResponse(result);
      
      // If data is an object with expected properties, use it
      if (typeof data === 'object' && data.message) {
        return {
          success: true,
          data
        };
      }
      
      // Otherwise create a standard response
      return {
        success: true,
        data: {
          message: data || `Git repository initialized at ${path}`,
          path
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize git repository: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async addFiles(args: any): Promise<ServiceResult> {
    const files = args?.files || [];
    const repoPath = args?.path || this.repositoryPath;
    
    if (files.length === 0) {
      return {
        success: false,
        error: 'No files specified for git add'
      };
    }

    try {
      const result = await this.callMcpTool('git_add', { 
        repo_path: repoPath,
        files 
      });
      
      // Parse response
      const data = this.parseResponse(result);
      
      // If data is an object with expected properties, use it
      if (typeof data === 'object' && data.added) {
        return {
          success: true,
          data
        };
      }
      
      // Otherwise create a standard response
      return {
        success: true,
        data: {
          added: files,
          message: data || `Added ${files.length} files to staging`
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add files: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async commitChanges(args: any): Promise<ServiceResult> {
    const message = args?.message;
    const repoPath = args?.path || this.repositoryPath;
    const files = args?.files;
    
    if (!message || message.trim() === '') {
      return {
        success: false,
        error: 'Commit message is required'
      };
    }

    try {
      const commitArgs: any = { 
        repo_path: repoPath,
        message 
      };
      
      if (files && files.length > 0) {
        commitArgs.files = files;
      }
      
      const result = await this.callMcpTool('git_commit', commitArgs);
      
      // Parse response
      const data = this.parseResponse(result);
      
      // If data is an object with expected properties, use it
      if (typeof data === 'object' && (data.message || data.hash)) {
        return {
          success: true,
          data
        };
      }
      
      // Otherwise create a standard response
      return {
        success: true,
        data: {
          message,
          hash: 'unknown',
          files: files || []
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to commit changes: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async getStatus(args: any): Promise<ServiceResult> {
    const repoPath = args?.path || this.repositoryPath;
    
    try {
      const result = await this.callMcpTool('git_status', { 
        repository: repoPath 
      });
      
      // Parse response
      const data = this.parseResponse(result);
      
      // If response is empty, return error
      if (!data) {
        return {
          success: false,
          error: 'No response from git status'
        };
      }
      
      return {
        success: true,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get repository status: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async getLog(args: any): Promise<ServiceResult> {
    const repoPath = args?.path || this.repositoryPath;
    const limit = args?.limit || 10;
    
    try {
      const result = await this.callMcpTool('git_log', { 
        repository: repoPath,
        max_count: limit 
      });
      
      // Parse response
      const data = this.parseResponse(result);
      
      return {
        success: true,
        data: data || 'No commits found'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get commit log: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async getDiff(args: any): Promise<ServiceResult> {
    const repoPath = args?.path || this.repositoryPath;
    const files = args?.files;
    const staged = args?.staged || false;
    
    try {
      const diffArgs: any = { 
        repository: repoPath,
        staged 
      };
      
      if (files) {
        diffArgs.files = files;
      }
      
      const result = await this.callMcpTool('git_diff', diffArgs);
      
      // Parse response
      const data = this.parseResponse(result);
      
      return {
        success: true,
        data: data || 'No differences found'
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get diff: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async manageBranches(args: any): Promise<ServiceResult> {
    const repoPath = args?.path || this.repositoryPath;
    const branchName = args?.name;
    const create = args?.create || false;
    const deleteBranch = args?.delete || false;
    
    try {
      if (create && branchName) {
        // Create new branch
        await this.callMcpTool('git_branch', { 
          repository: repoPath,
          branch: branchName,
          create: true 
        });
        
        return {
          success: true,
          data: `Branch '${branchName}' created successfully`
        };
      } else if (deleteBranch && branchName) {
        // Delete branch
        await this.callMcpTool('git_branch', { 
          repository: repoPath,
          branch: branchName,
          delete: true 
        });
        
        return {
          success: true,
          data: `Branch '${branchName}' deleted successfully`
        };
      } else {
        // List branches
        const result = await this.callMcpTool('git_branch', { 
          repository: repoPath 
        });
        
        const data = this.parseResponse(result);
        
        return {
          success: true,
          data: data || 'No branches found'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to manage branches: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async checkout(args: any): Promise<ServiceResult> {
    const repoPath = args?.path || this.repositoryPath;
    const branch = args?.branch;
    const file = args?.file;
    const createBranch = args?.create || false;
    
    if (!branch && !file) {
      return {
        success: false,
        error: 'Either branch or file must be specified for checkout'
      };
    }

    try {
      const checkoutArgs: any = { 
        repository: repoPath 
      };
      
      if (branch) {
        checkoutArgs.branch = branch;
        if (createBranch) {
          checkoutArgs.create = true;
        }
      }
      
      if (file) {
        checkoutArgs.file = file;
      }
      
      const result = await this.callMcpTool('git_checkout', checkoutArgs);
      
      const data = this.parseResponse(result);
      
      return {
        success: true,
        data: data || `Checked out ${branch || file}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to checkout: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async push(args: any): Promise<ServiceResult> {
    const repoPath = args?.path || this.repositoryPath;
    const remote = args?.remote || 'origin';
    const branch = args?.branch || 'main';
    const force = args?.force || false;
    
    try {
      const result = await this.callMcpTool('git_push', { 
        repository: repoPath,
        remote,
        branch,
        force 
      });
      
      const data = this.parseResponse(result);
      
      return {
        success: true,
        data: data || `Pushed to ${remote}/${branch}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to push: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async pull(args: any): Promise<ServiceResult> {
    const repoPath = args?.path || this.repositoryPath;
    const remote = args?.remote || 'origin';
    const branch = args?.branch || 'main';
    
    try {
      const result = await this.callMcpTool('git_pull', { 
        repository: repoPath,
        remote,
        branch 
      });
      
      const data = this.parseResponse(result);
      
      return {
        success: true,
        data: data || `Pulled from ${remote}/${branch}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to pull: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

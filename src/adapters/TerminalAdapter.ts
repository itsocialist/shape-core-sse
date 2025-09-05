/**
 * TerminalAdapter - Terminal command execution via Desktop Commander MCP
 * 
 * Provides terminal command execution capabilities through Desktop Commander MCP service
 * Supports dependency injection for testing
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ServiceAdapter } from './base/ServiceAdapter.js';
import { ServiceCapability, ServiceCommand, ServiceResult } from './base/types.js';

interface AdapterOptions {
  mcpClient?: Client;
  mcpTransport?: StdioClientTransport;
}

interface SessionInfo {
  pid: number;
  command: string;
  startTime: Date;
  cwd?: string;
}

export class TerminalAdapter extends ServiceAdapter {
  private mcpClient: Client | null = null;
  private mcpTransport: StdioClientTransport | null = null;
  private isConnected: boolean = false;
  private activeSessions: Map<number, SessionInfo> = new Map();
  private injectedClient: boolean = false;

  constructor(options?: AdapterOptions) {
    super();
    if (options?.mcpClient && options?.mcpTransport) {
      this.mcpClient = options.mcpClient;
      this.mcpTransport = options.mcpTransport;
      this.injectedClient = true;
      this.isConnected = true;
    }
  }

  getName(): string {
    return 'terminal';
  }

  getDescription(): string {
    return 'Terminal command execution via Desktop Commander MCP';
  }

  async getCapabilities(): Promise<ServiceCapability[]> {
    return [
      {
        name: 'execute',
        description: 'Execute a terminal command',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to execute' },
            cwd: { type: 'string', description: 'Working directory (optional)' },
            timeout: { type: 'number', description: 'Timeout in milliseconds', default: 30000 }
          },
          required: ['command']
        }
      },
      {
        name: 'read_output',
        description: 'Read output from a running command',
        inputSchema: {
          type: 'object',
          properties: {
            pid: { type: 'number', description: 'Process ID' },
            timeout: { type: 'number', description: 'Timeout in milliseconds', default: 5000 }
          },
          required: ['pid']
        }
      },
      {
        name: 'list_sessions',
        description: 'List active terminal sessions',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'kill_session',
        description: 'Kill a terminal session',
        inputSchema: {
          type: 'object',
          properties: {
            pid: { type: 'number', description: 'Process ID to kill' }
          },
          required: ['pid']
        }
      },
      {
        name: 'check_command',
        description: 'Check if a command exists in the system',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'Command to check' }
          },
          required: ['command']
        }
      }
    ];
  }

  async initialize(): Promise<void> {
    if (this.injectedClient || this.isConnected) {
      return;
    }

    try {
      this.mcpTransport = new StdioClientTransport({
        command: 'npx',
        args: ['-y', '@wonderwhy-er/desktop-commander']
      });

      this.mcpClient = new Client({
        name: 'mpcm-terminal-adapter',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await this.mcpClient.connect(this.mcpTransport);
      this.isConnected = true;
    } catch (error) {
      throw new Error(`Failed to connect to Desktop Commander MCP: ${error}`);
    }
  }

  async execute(command: ServiceCommand): Promise<ServiceResult> {
    // Initialize if not connected and not using injected client
    if (!this.isConnected && !this.injectedClient) {
      await this.initialize();
    }

    try {
      switch (command.tool) {
        case 'execute':
          return await this.executeCommand(command.args);
        case 'read_output':
          return await this.readOutput(command.args);
        case 'list_sessions':
          return await this.listSessions();
        case 'kill_session':
          return await this.killSession(command.args);
        case 'check_command':
          return await this.checkCommand(command.args);
        default:
          return {
            success: false,
            error: `Unknown terminal tool: ${command.tool}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Terminal operation failed: ${error}`
      };
    }
  }

  private async executeCommand(args: any): Promise<ServiceResult> {
    const { command, cwd, timeout = 30000 } = args;

    if (!command) {
      return {
        success: false,
        error: 'Command is required'
      };
    }

    if (!this.mcpClient) {
      return {
        success: false,
        error: 'Terminal adapter not initialized'
      };
    }

    try {
      // Build the full command with cwd if provided
      const fullCommand = cwd ? `cd "${cwd}" && ${command}` : command;
      
      const result = await this.mcpClient.callTool({
        name: 'execute_command',
        arguments: {
          command: fullCommand,
          timeout_ms: timeout
        }
      });

      // Parse the output to extract information
      const output = (result as any).content?.[0]?.text || '';
      const lines = output.split('\n');
      
      // Extract PID if it's a long-running command
      const pidMatch = lines[0]?.match(/PID (\d+)/);
      const pid = pidMatch ? parseInt(pidMatch[1]) : undefined;

      // Check if command timed out
      // Look for various timeout indicators in the output
      const timedOut = output.includes('timed out') || 
                      output.includes('timeout') ||
                      output.includes('did not complete within') ||
                      (output.includes('continues running') && timeout < 30000); // If it's still running and we had a short timeout
      
      // Extract exit code if available
      let exitCode = 0;
      const exitCodeMatch = output.match(/Exit code: (\d+)/);
      if (exitCodeMatch) {
        exitCode = parseInt(exitCodeMatch[1]);
      } else if (output.includes('Command failed')) {
        exitCode = 1;
      }

      // Track session if it's still running
      if (pid && (timedOut || output.includes('continues running'))) {
        this.activeSessions.set(pid, {
          pid,
          command,
          startTime: new Date(),
          cwd
        });
      }

      return {
        success: true,
        data: {
          output,
          exitCode,
          pid,
          timedOut,
          cwd
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Command execution failed: ${error}`
      };
    }
  }

  private async readOutput(args: any): Promise<ServiceResult> {
    const { pid, timeout = 5000 } = args;

    if (!pid) {
      return {
        success: false,
        error: 'PID is required'
      };
    }

    if (!this.mcpClient) {
      return {
        success: false,
        error: 'Terminal adapter not initialized'
      };
    }

    try {
      const result = await this.mcpClient.callTool({
        name: 'read_output',
        arguments: {
          pid,
          timeout_ms: timeout
        }
      });

      const output = (result as any).content?.[0]?.text || '';

      return {
        success: true,
        data: {
          pid,
          output,
          hasMore: !output.includes('Process completed') && !output.includes('No new output')
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read output: ${error}`
      };
    }
  }

  private async listSessions(): Promise<ServiceResult> {
    if (!this.mcpClient) {
      return {
        success: false,
        error: 'Terminal adapter not initialized'
      };
    }

    try {
      const result = await this.mcpClient.callTool({
        name: 'list_sessions',
        arguments: {}
      });

      const output = (result as any).content?.[0]?.text || '';
      
      // Parse sessions from output
      const sessions: any[] = [];
      const sessionMatches = output.matchAll(/PID: (\d+)/g);
      
      for (const match of sessionMatches) {
        const pid = parseInt(match[1]);
        const localSession = this.activeSessions.get(pid);
        
        sessions.push({
          pid,
          command: localSession?.command || 'Unknown',
          startTime: localSession?.startTime || new Date(),
          cwd: localSession?.cwd
        });
      }

      return {
        success: true,
        data: {
          count: sessions.length,
          sessions
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list sessions: ${error}`
      };
    }
  }

  private async killSession(args: any): Promise<ServiceResult> {
    const { pid } = args;

    if (!pid) {
      return {
        success: false,
        error: 'PID is required'
      };
    }

    if (!this.mcpClient) {
      return {
        success: false,
        error: 'Terminal adapter not initialized'
      };
    }

    try {
      const result = await this.mcpClient.callTool({
        name: 'force_terminate',
        arguments: { pid }
      });

      const output = (result as any).content?.[0]?.text || '';
      
      // Remove from active sessions
      this.activeSessions.delete(pid);

      return {
        success: true,
        data: {
          pid,
          message: output
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to kill session: ${error}`
      };
    }
  }

  private async checkCommand(args: any): Promise<ServiceResult> {
    const { command } = args;

    if (!command) {
      return {
        success: false,
        error: 'Command is required'
      };
    }

    if (!this.mcpClient) {
      return {
        success: false,
        error: 'Terminal adapter not initialized'
      };
    }

    try {
      // Use 'which' command to check if command exists
      const result = await this.mcpClient.callTool({
        name: 'execute_command',
        arguments: {
          command: `which ${command}`,
          timeout_ms: 5000
        }
      });

      const output = (result as any).content?.[0]?.text || '';
      const lines = output.split('\n');
      
      // Check if command was found by looking for a path in the output
      // 'which' returns the path if found, or nothing/error if not found
      const pathLine = lines.find(line => 
        line.trim() && 
        (line.startsWith('/') || line.includes(`/${command}`)) && 
        !line.includes('not found') &&
        !line.includes('Command failed')
      );
      
      const exists = !!pathLine;
      
      return {
        success: true,
        data: {
          command,
          exists,
          path: exists ? pathLine.trim() : null
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to check command: ${error}`
      };
    }
  }

  async cleanup(): Promise<void> {
    // Only try to clean up sessions if we're connected
    if (this.isConnected && this.activeSessions.size > 0) {
      // Clean up any active sessions
      for (const [pid, _] of this.activeSessions) {
        try {
          // Call the MCP tool directly for cleanup
          if (this.mcpClient) {
            await this.mcpClient.callTool({
              name: 'force_terminate',
              arguments: { pid }
            });
          }
        } catch (error) {
          console.error(`Failed to kill session ${pid}:`, error);
        }
      }
    }
    
    this.activeSessions.clear();
    
    if (this.mcpTransport && !this.injectedClient) {
      await this.mcpTransport.close();
    }
    
    this.mcpClient = null;
    this.mcpTransport = null;
    this.isConnected = false;
  }
}

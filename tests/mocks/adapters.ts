/**
 * Mock implementation of adapters for testing
 * Avoids external MCP server dependencies in tests
 */

import { BaseAdapter, ServiceCapability, ServiceCommand, ServiceResult } from '../../src/adapters/base/types';

export class MockGitAdapter implements BaseAdapter {
  private repositoryPath: string;
  private initialized = false;
  private hasRepo = false;
  private files = new Set<string>();
  private commits: string[] = [];

  constructor(repositoryPath: string) {
    this.repositoryPath = repositoryPath;
  }

  getName(): string {
    return 'git';
  }

  getDescription(): string {
    return 'Mock Git operations for testing';
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async getCapabilities(): Promise<ServiceCapability[]> {
    return [
      { name: 'init', description: 'Initialize a new Git repository' },
      { name: 'add', description: 'Stage files for commit' },
      { name: 'commit', description: 'Commit staged changes' },
      { name: 'status', description: 'Get repository status' },
      { name: 'log', description: 'View commit history' }
    ];
  }

  async execute(command: ServiceCommand): Promise<ServiceResult> {
    if (!this.initialized) {
      return { success: false, error: 'Adapter not initialized' };
    }

    switch (command.tool) {
      case 'init':
        this.hasRepo = true;
        return { success: true, data: { message: 'Initialized empty Git repository' } };

      case 'add':
        if (!this.hasRepo) {
          return { success: false, error: 'Not a git repository' };
        }
        const files = command.args?.files || [];
        files.forEach((f: string) => this.files.add(f));
        return { success: true, data: { filesAdded: files.length } };

      case 'commit':
        if (!this.hasRepo) {
          return { success: false, error: 'Not a git repository' };
        }
        const message = command.args?.message || 'No message';
        this.commits.push(message);
        this.files.clear();
        return { success: true, data: { message, commitId: `mock-${Date.now()}` } };

      case 'status':
        return {
          success: true,
          data: {
            hasRepo: this.hasRepo,
            stagedFiles: Array.from(this.files),
            commits: this.commits.length
          }
        };

      case 'log':
        return {
          success: true,
          data: {
            commits: this.commits.map((msg, i) => ({
              id: `mock-${i}`,
              message: msg
            }))
          }
        };

      default:
        return { success: false, error: `Unknown git tool: ${command.tool}` };
    }
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }
}

export class MockTerminalAdapter implements BaseAdapter {
  private commandHistory: Array<{ command: string; output: string }> = [];
  private gitCommits: string[] = [];

  getName(): string {
    return 'terminal';
  }

  getDescription(): string {
    return 'Mock terminal operations for testing';
  }

  async initialize(): Promise<void> {
    // No-op
  }

  async getCapabilities(): Promise<ServiceCapability[]> {
    return [
      { name: 'execute', description: 'Execute a terminal command' },
      { name: 'check_command', description: 'Check if a command exists' }
    ];
  }

  // Method to simulate git commits from GitAdapter
  simulateGitCommit(message: string): void {
    this.gitCommits.push(message);
  }

  async execute(command: ServiceCommand): Promise<ServiceResult> {
    switch (command.tool) {
      case 'execute':
        const cmd = command.args?.command;
        if (!cmd) {
          return { success: false, error: 'Command is required' };
        }

        // Simulate command execution
        let output = '';
        let exitCode = 0;

        if (cmd.includes('ls')) {
          output = 'README.md\nsrc\n.git';
          if (cmd.includes('git log')) {
            // Combined command
            output += '\nmock-123 Initial commit - Project created by MPCM-Pro';
          }
        } else if (cmd.includes('git log')) {
          // Simulate git log output
          output = 'mock-123 Initial commit - Project created by MPCM-Pro';
        } else if (cmd.includes('pwd')) {
          output = command.args?.cwd || '/mock/dir';
        } else {
          output = `Mock output for: ${cmd}`;
        }

        this.commandHistory.push({ command: cmd, output });

        return {
          success: true,
          data: {
            output,
            exitCode,
            command: cmd,
            cwd: command.args?.cwd
          }
        };

      case 'check_command':
        const checkCmd = command.args?.command;
        if (!checkCmd) {
          return { success: false, error: 'Command is required' };
        }
        
        // Simulate common commands existing
        const exists = ['ls', 'git', 'pwd', 'echo'].includes(checkCmd);
        return {
          success: true,
          data: { command: checkCmd, exists }
        };

      default:
        return { success: false, error: `Unknown terminal tool: ${command.tool}` };
    }
  }

  async shutdown(): Promise<void> {
    this.commandHistory = [];
    this.gitCommits = [];
  }
}

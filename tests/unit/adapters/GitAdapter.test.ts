/**
 * GitAdapter Tests
 * Tests the Git MCP server integration adapter with both mocked and real implementations
 */

import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { GitAdapter } from '../../../src/adapters/GitAdapter';
import { ServiceCommand, ServiceResult } from '../../../src/types/ServiceTypes';
import { 
  USE_REAL_MCP, 
  MCP_TEST_TIMEOUT,
  createMockMCP,
  describeWithMock,
  describeWithMCP,
  cleanupMCPConnection,
  MCPResponseBuilders
} from '../../helpers/mcp-test-helper';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

// Only mock if we're not using real MCP
if (!USE_REAL_MCP) {
  const { client, transport } = createMockMCP();
  
  jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
    Client: jest.fn(() => client)
  }));
  
  jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
    StdioClientTransport: jest.fn(() => transport)
  }));
}

describe('GitAdapter', () => {
  let gitAdapter: GitAdapter;
  let testRepoPath: string;

  beforeEach(async () => {
    testRepoPath = path.join(process.cwd(), 'test-temp-repo-' + Date.now());
    gitAdapter = new GitAdapter(testRepoPath);
  });

  afterEach(async () => {
    await gitAdapter.cleanup();
    
    // Clean up test repository
    try {
      await fs.rm(testRepoPath, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
  });

  // Common tests that run for both mocked and real implementations
  describe('Basic Properties', () => {
    it('should create GitAdapter instance', () => {
      expect(gitAdapter).toBeInstanceOf(GitAdapter);
    });

    it('should have correct service name', () => {
      expect(gitAdapter.getName()).toBe('git');
    });

    it('should have correct description', () => {
      expect(gitAdapter.getDescription()).toContain('Git');
    });

    it('should provide git capabilities', async () => {
      const capabilities = await gitAdapter.getCapabilities();
      expect(capabilities).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'init' }),
        expect.objectContaining({ name: 'add' }),
        expect.objectContaining({ name: 'commit' }),
        expect.objectContaining({ name: 'status' })
      ]));
    });

    it('should implement shutdown method', async () => {
      expect(gitAdapter.shutdown).toBeDefined();
      expect(typeof gitAdapter.shutdown).toBe('function');
      
      // Should not throw when called
      await expect(gitAdapter.shutdown()).resolves.not.toThrow();
    });
  });

  // Unit tests with mocked MCP client
  describeWithMock('Unit Tests (Mocked)', () => {
    let mockClient: any;
    let mockTransport: any;

    beforeEach(() => {
      // Get the mocked instances
      const { Client } = jest.requireMock('@modelcontextprotocol/sdk/client/index.js');
      const { StdioClientTransport } = jest.requireMock('@modelcontextprotocol/sdk/client/stdio.js');
      
      mockClient = new Client();
      mockTransport = new StdioClientTransport();
      
      // Inject the mock client into the GitAdapter
      gitAdapter = new GitAdapter({
        repositoryPath: testRepoPath,
        mcpClient: mockClient,
        mcpTransport: mockTransport
      });
    });

    describe('Git Operations', () => {
      it('should handle git init command', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success('Initialized empty Git repository')
        );

        const command: ServiceCommand = {
          tool: 'init',
          args: { path: testRepoPath }
        };

        const result = await gitAdapter.execute(command);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining({
          message: expect.stringContaining('Initialized')
        }));
        expect(mockClient.callTool).toHaveBeenCalledWith({
          name: 'git_init',
          arguments: { repository: testRepoPath }
        });
      });

      it('should handle git add command', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success('Added files to staging')
        );

        const command: ServiceCommand = {
          tool: 'add',
          args: { 
            path: testRepoPath,
            files: ['.']
          }
        };

        const result = await gitAdapter.execute(command);

        expect(result.success).toBe(true);
        expect(mockClient.callTool).toHaveBeenCalledWith({
          name: 'git_add',
          arguments: {
            repo_path: testRepoPath,
            files: ['.']
          }
        });
      });

      it('should handle git commit command', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success('[main abc123] Test commit')
        );

        const command: ServiceCommand = {
          tool: 'commit',
          args: {
            path: testRepoPath,
            message: 'Test commit'
          }
        };

        const result = await gitAdapter.execute(command);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(expect.objectContaining({
          message: 'Test commit'
        }));
        expect(mockClient.callTool).toHaveBeenCalledWith({
          name: 'git_commit',
          arguments: {
            repo_path: testRepoPath,
            message: 'Test commit'
          }
        });
      });

      it('should handle git status command', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success('On branch main\nnothing to commit')
        );

        const command: ServiceCommand = {
          tool: 'status',
          args: { path: testRepoPath }
        };

        const result = await gitAdapter.execute(command);

        expect(result.success).toBe(true);
        expect(result.data).toContain('On branch main');
      });
    });

    describe('Error Handling', () => {
      it('should handle unknown tool', async () => {
        const command: ServiceCommand = {
          tool: 'unknown',
          args: {}
        };

        const result = await gitAdapter.execute(command);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Unknown git tool');
      });

      it('should handle MCP errors', async () => {
        mockClient.callTool.mockRejectedValue(new Error('MCP connection failed'));

        const command: ServiceCommand = {
          tool: 'status',
          args: { path: testRepoPath }
        };

        const result = await gitAdapter.execute(command);

        expect(result.success).toBe(false);
        expect(result.error).toContain('MCP');
      });

      it('should handle empty responses', async () => {
        mockClient.callTool.mockResolvedValue(MCPResponseBuilders.empty());

        const command: ServiceCommand = {
          tool: 'status',
          args: { path: testRepoPath }
        };

        const result = await gitAdapter.execute(command);

        expect(result.success).toBe(false);
        expect(result.error).toContain('response');
      });
    });
  });

  // Integration tests with real Git MCP server
  describeWithMCP('Integration Tests (Real MCP)', () => {
    beforeEach(async () => {
      // Create a real test repository
      await fs.mkdir(testRepoPath, { recursive: true });
      
      // Initialize git repo
      execSync('git init', { cwd: testRepoPath });
      execSync('git config user.name "Test User"', { cwd: testRepoPath });
      execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    }, MCP_TEST_TIMEOUT);

    it('should perform complete git workflow', async () => {
      // Create a test file
      const testFile = path.join(testRepoPath, 'test.txt');
      await fs.writeFile(testFile, 'Hello, Git MCP!');

      // 1. Check status (should show untracked file)
      let result = await gitAdapter.execute({
        tool: 'status',
        args: { path: testRepoPath }
      });
      expect(result.success).toBe(true);
      expect(result.data).toContain('test.txt');

      // 2. Add the file
      result = await gitAdapter.execute({
        tool: 'add',
        args: {
          path: testRepoPath,
          files: ['test.txt']
        }
      });
      expect(result.success).toBe(true);

      // 3. Commit the file
      result = await gitAdapter.execute({
        tool: 'commit',
        args: {
          path: testRepoPath,
          message: 'Add test file'
        }
      });
      expect(result.success).toBe(true);
      expect(result.data).toContain('Add test file');

      // 4. Check status again (should be clean)
      result = await gitAdapter.execute({
        tool: 'status',
        args: { path: testRepoPath }
      });
      expect(result.success).toBe(true);
      expect(result.data).toContain('nothing to commit');
    }, MCP_TEST_TIMEOUT);

    it('should handle git branch operations', async () => {
      // Create initial commit
      const testFile = path.join(testRepoPath, 'README.md');
      await fs.writeFile(testFile, '# Test Repo');
      
      await gitAdapter.execute({
        tool: 'add',
        args: { path: testRepoPath, files: ['.'] }
      });
      
      await gitAdapter.execute({
        tool: 'commit',
        args: { path: testRepoPath, message: 'Initial commit' }
      });

      // Create a new branch
      const result = await gitAdapter.execute({
        tool: 'branch',
        args: {
          path: testRepoPath,
          name: 'feature-branch',
          create: true
        }
      });

      expect(result.success).toBe(true);
      
      // List branches
      const branchList = await gitAdapter.execute({
        tool: 'branch',
        args: { path: testRepoPath }
      });
      
      expect(branchList.success).toBe(true);
      expect(branchList.data).toContain('feature-branch');
    }, MCP_TEST_TIMEOUT);

    it('should handle git errors gracefully', async () => {
      // Try to commit without staging
      const result = await gitAdapter.execute({
        tool: 'commit',
        args: {
          path: testRepoPath,
          message: 'Empty commit'
        }
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }, MCP_TEST_TIMEOUT);
  });
});

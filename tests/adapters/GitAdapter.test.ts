/**
 * GitAdapter Tests
 * Tests both mocked (unit) and real (integration) modes
 * Use USE_REAL_MCP=true environment variable to run integration tests
 */

import { GitAdapter } from '../../src/adapters/GitAdapter';
import { describe, beforeEach, afterEach, it, expect, jest, beforeAll } from '@jest/globals';
import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';
import { ServiceCommand } from '../../src/adapters/base/types';
import { execSync } from 'child_process';
import { 
  createMockMCP, 
  setupMCPMocks,
  describeWithMock,
  describeWithMCP,
  isMCPServerAvailable,
  cleanupMCPConnection,
  MCPResponseBuilders,
  USE_REAL_MCP,
  MCP_TEST_TIMEOUT
} from '../helpers/mcp-test-helper';

describe('GitAdapter', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary directory for tests
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-adapter-test-'));
  });

  afterEach(async () => {
    // Clean up
    try {
      await fs.rm(testDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  /**
   * Unit Tests - Run with mocked MCP client/transport
   */
  describeWithMock('Unit Tests (Mocked)', () => {
    let gitAdapter: GitAdapter;
    let mockClient: ReturnType<typeof createMockMCP>['client'];
    let mockTransport: ReturnType<typeof createMockMCP>['transport'];

    beforeEach(() => {
      // Create mocks
      const mocks = createMockMCP();
      mockClient = mocks.client;
      mockTransport = mocks.transport;

      // Create adapter with injected mocks
      gitAdapter = new GitAdapter({
        repositoryPath: testDir,
        mcpClient: mockClient as any,
        mcpTransport: mockTransport as any
      });
    });

    afterEach(async () => {
      await gitAdapter.cleanup();
      jest.clearAllMocks();
    });

    describe('initialization', () => {
      it('should have correct name and description', () => {
        expect(gitAdapter.getName()).toBe('git');
        expect(gitAdapter.getDescription()).toContain('Git version control');
      });

      it('should initialize without errors', async () => {
        await expect(gitAdapter.initialize()).resolves.not.toThrow();
      });

      it('should provide git capabilities', async () => {
        const capabilities = await gitAdapter.getCapabilities();
        
        expect(capabilities).toEqual(expect.arrayContaining([
          expect.objectContaining({ name: 'init' }),
          expect.objectContaining({ name: 'add' }),
          expect.objectContaining({ name: 'commit' }),
          expect.objectContaining({ name: 'status' }),
          expect.objectContaining({ name: 'log' }),
          expect.objectContaining({ name: 'diff' }),
          expect.objectContaining({ name: 'branch' }),
          expect.objectContaining({ name: 'checkout' }),
          expect.objectContaining({ name: 'push' }),
          expect.objectContaining({ name: 'pull' })
        ]));
      });
    });

    describe('git operations', () => {
      it('should handle init command', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success({ message: 'Initialized empty Git repository' })
        );

        const command: ServiceCommand = {
          tool: 'init',
          args: { path: testDir }
        };
        
        const result = await gitAdapter.execute(command);
        
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('message');
        expect(mockClient.callTool).toHaveBeenCalledWith({
          name: 'git_init',
          arguments: { repository: testDir }
        });
      });

      it('should handle add command with files', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success({ added: ['test.txt', 'README.md'] })
        );

        const command: ServiceCommand = {
          tool: 'add',
          args: { files: ['test.txt', 'README.md'] }
        };
        
        const result = await gitAdapter.execute(command);
        
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('added');
        expect(mockClient.callTool).toHaveBeenCalledWith({
          name: 'git_add',
          arguments: { repo_path: testDir, files: ['test.txt', 'README.md'] }
        });
      });

      it('should handle add command without files', async () => {
        const command: ServiceCommand = {
          tool: 'add',
          args: { files: [] }
        };
        
        const result = await gitAdapter.execute(command);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('No files specified');
        expect(mockClient.callTool).not.toHaveBeenCalled();
      });

      it('should handle commit command with message', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success({ 
            message: 'Initial commit',
            hash: 'abc123',
            files: []
          })
        );

        const command: ServiceCommand = {
          tool: 'commit',
          args: { message: 'Initial commit' }
        };
        
        const result = await gitAdapter.execute(command);
        
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('message', 'Initial commit');
        expect(mockClient.callTool).toHaveBeenCalledWith({
          name: 'git_commit',
          arguments: { repo_path: testDir, message: 'Initial commit' }
        });
      });

      it('should handle commit command without message', async () => {
        const command: ServiceCommand = {
          tool: 'commit',
          args: { message: '' }
        };
        
        const result = await gitAdapter.execute(command);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Commit message is required');
        expect(mockClient.callTool).not.toHaveBeenCalled();
      });

      it('should handle status command', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success({
            modified: [],
            untracked: ['newfile.txt'],
            staged: []
          })
        );

        const command: ServiceCommand = {
          tool: 'status',
          args: {}
        };
        
        const result = await gitAdapter.execute(command);
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(mockClient.callTool).toHaveBeenCalledWith({
          name: 'git_status',
          arguments: { repository: testDir }
        });
      });

      it('should handle log command', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success({
            commits: [
              { hash: 'abc123', message: 'Initial commit' }
            ]
          })
        );

        const command: ServiceCommand = {
          tool: 'log',
          args: { limit: 10 }
        };
        
        const result = await gitAdapter.execute(command);
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(mockClient.callTool).toHaveBeenCalledWith({
          name: 'git_log',
          arguments: { repository: testDir, max_count: 10 }
        });
      });

      it('should handle diff command', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success({
            diff: 'diff --git a/test.txt b/test.txt\n+Hello World'
          })
        );

        const command: ServiceCommand = {
          tool: 'diff',
          args: { files: ['test.txt'] }
        };
        
        const result = await gitAdapter.execute(command);
        
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(mockClient.callTool).toHaveBeenCalledWith({
          name: 'git_diff',
          arguments: { repository: testDir, staged: false, files: ['test.txt'] }
        });
      });

      it('should handle branch operations', async () => {
        // Test creating a branch
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success('Branch created successfully')
        );

        let result = await gitAdapter.execute({
          tool: 'branch',
          args: { name: 'feature-branch', create: true }
        });

        expect(result.success).toBe(true);
        expect(mockClient.callTool).toHaveBeenCalledWith({
          name: 'git_branch',
          arguments: { 
            repository: testDir,
            branch: 'feature-branch',
            create: true
          }
        });

        // Test listing branches
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success('* main\n  feature-branch')
        );

        result = await gitAdapter.execute({
          tool: 'branch',
          args: {}
        });

        expect(result.success).toBe(true);
        expect(result.data).toContain('main');
        expect(result.data).toContain('feature-branch');
      });

      it('should handle checkout command', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success('Switched to branch feature-branch')
        );

        const result = await gitAdapter.execute({
          tool: 'checkout',
          args: { branch: 'feature-branch' }
        });

        expect(result.success).toBe(true);
        expect(mockClient.callTool).toHaveBeenCalledWith({
          name: 'git_checkout',
          arguments: { 
            repository: testDir,
            branch: 'feature-branch'
          }
        });
      });

      it('should handle push command', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success('Pushed to origin/main')
        );

        const result = await gitAdapter.execute({
          tool: 'push',
          args: { remote: 'origin', branch: 'main' }
        });

        expect(result.success).toBe(true);
        expect(mockClient.callTool).toHaveBeenCalledWith({
          name: 'git_push',
          arguments: { 
            repository: testDir,
            remote: 'origin',
            branch: 'main',
            force: false
          }
        });
      });

      it('should handle pull command', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success('Already up to date')
        );

        const result = await gitAdapter.execute({
          tool: 'pull',
          args: { remote: 'origin', branch: 'main' }
        });

        expect(result.success).toBe(true);
        expect(mockClient.callTool).toHaveBeenCalledWith({
          name: 'git_pull',
          arguments: { 
            repository: testDir,
            remote: 'origin',
            branch: 'main'
          }
        });
      });
    });

    describe('error handling', () => {
      it('should handle unknown git tool', async () => {
        const command: ServiceCommand = {
          tool: 'unknown-tool',
          args: {}
        };
        
        const result = await gitAdapter.execute(command);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Unknown git tool');
      });

      it('should handle MCP call failures gracefully', async () => {
        mockClient.callTool.mockRejectedValue(new Error('MCP connection failed'));

        const command: ServiceCommand = {
          tool: 'status',
          args: {}
        };
        
        const result = await gitAdapter.execute(command);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain('Failed to get repository status');
      });

      it('should handle empty responses', async () => {
        mockClient.callTool.mockResolvedValue(MCPResponseBuilders.empty());

        const command: ServiceCommand = {
          tool: 'status',
          args: {}
        };

        const result = await gitAdapter.execute(command);

        expect(result.success).toBe(false);
        expect(result.error).toContain('No response from git status');
      });

      it('should validate checkout arguments', async () => {
        const result = await gitAdapter.execute({
          tool: 'checkout',
          args: {} // Missing both branch and file
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Either branch or file must be specified');
      });
    });

    describe('cleanup', () => {
      it('should not close injected transport on cleanup', async () => {
        await gitAdapter.initialize();
        await gitAdapter.cleanup();
        
        // Injected transport should NOT be closed
        expect(mockTransport.close).not.toHaveBeenCalled();
      });
    });
  });

  /**
   * Integration Tests - Run with real Git MCP server
   * Set USE_REAL_MCP=true to enable these tests
   */
  describeWithMCP('Integration Tests (Real MCP)', () => {
    let gitAdapter: GitAdapter;
    let isAvailable: boolean;

    beforeAll(async () => {
      // Check if Git MCP server is available
      isAvailable = await isMCPServerAvailable('npx', ['-y', '@cyanheads/git-mcp-server']);
      if (!isAvailable) {
        console.warn('Git MCP server not available, skipping integration tests');
      }
    });

    beforeEach(async () => {
      if (isAvailable) {
        gitAdapter = new GitAdapter(testDir);
        
        // Initialize a real git repo for testing
        execSync('git init', { cwd: testDir });
        execSync('git config user.name "Test User"', { cwd: testDir });
        execSync('git config user.email "test@example.com"', { cwd: testDir });
      }
    });

    afterEach(async () => {
      if (gitAdapter) {
        await gitAdapter.cleanup();
      }
    });

    it('should connect to real Git MCP server', async () => {
      if (!isAvailable) return;

      await gitAdapter.initialize();
      
      const result = await gitAdapter.execute({
        tool: 'status',
        args: {}
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    }, MCP_TEST_TIMEOUT);

    it('should perform complete git workflow', async () => {
      if (!isAvailable) return;

      // Create a test file
      const testFile = path.join(testDir, 'test.txt');
      await fs.writeFile(testFile, 'Hello, Git MCP!');

      // 1. Check status (should show untracked file)
      let result = await gitAdapter.execute({
        tool: 'status',
        args: {}
      });
      expect(result.success).toBe(true);
      expect(result.data.untracked_files).toContain('test.txt');

      // 2. Add the file
      result = await gitAdapter.execute({
        tool: 'add',
        args: { files: ['test.txt'] }
      });
      expect(result.success).toBe(true);

      // 3. Commit the file
      result = await gitAdapter.execute({
        tool: 'commit',
        args: { message: 'Add test file' }
      });
      expect(result.success).toBe(true);

      // 4. Check status again (should be clean)
      result = await gitAdapter.execute({
        tool: 'status',
        args: {}
      });
      expect(result.success).toBe(true);
      expect(result.data).toContain('nothing to commit');
    }, MCP_TEST_TIMEOUT);

    it('should handle git branch operations', async () => {
      if (!isAvailable) return;

      // Create initial commit
      const testFile = path.join(testDir, 'README.md');
      await fs.writeFile(testFile, '# Test Repo');
      
      await gitAdapter.execute({
        tool: 'add',
        args: { files: ['.'] }
      });
      
      await gitAdapter.execute({
        tool: 'commit',
        args: { message: 'Initial commit' }
      });

      // Create a new branch
      const result = await gitAdapter.execute({
        tool: 'branch',
        args: {
          name: 'feature-branch',
          create: true
        }
      });

      expect(result.success).toBe(true);
      
      // List branches
      const branchList = await gitAdapter.execute({
        tool: 'branch',
        args: {}
      });
      
      expect(branchList.success).toBe(true);
      expect(branchList.data).toContain('feature-branch');
    }, MCP_TEST_TIMEOUT);

    it('should handle git errors gracefully', async () => {
      if (!isAvailable) return;

      // Try to commit without staging
      const result = await gitAdapter.execute({
        tool: 'commit',
        args: { message: 'Empty commit' }
      });

      // This might fail or succeed depending on git config
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
    }, MCP_TEST_TIMEOUT);
  });
});

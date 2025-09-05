/**
 * Integration Tests for Git MCP Tools
 * Tests the integration of GitAdapter with MCP tool interface
 */

import { describe, beforeAll, afterAll, beforeEach, it, expect } from '@jest/globals';
import { join } from 'path';
import { DatabaseManager } from '../../src/db/database.js';
import { ServiceRegistry } from '../../src/orchestration/registry/ServiceRegistry.js';
import { GitAdapter } from '../../src/adapters/GitAdapter.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, rmSync, mkdirSync, writeFileSync } from 'fs';

const execAsync = promisify(exec);

describe('Git MCP Integration', () => {
  let db: DatabaseManager;
  let registry: ServiceRegistry;
  let gitAdapter: GitAdapter;
  let testRepoPath: string;

  beforeAll(async () => {
    // Setup test database
    db = await DatabaseManager.create(':memory:');
    
    // Setup test repository
    testRepoPath = join('/tmp', `test-repo-${Date.now()}`);
    mkdirSync(testRepoPath, { recursive: true });
    
    // Initialize git repo
    await execAsync('git init', { cwd: testRepoPath });
    await execAsync('git config user.name "Test User"', { cwd: testRepoPath });
    await execAsync('git config user.email "test@example.com"', { cwd: testRepoPath });
  });

  afterAll(async () => {
    // Cleanup
    if (gitAdapter) {
      await gitAdapter.cleanup();
    }
    if (existsSync(testRepoPath)) {
      rmSync(testRepoPath, { recursive: true, force: true });
    }
    db.close();
  });

  beforeEach(async () => {
    // Create fresh instances for each test to avoid conflicts
    registry = new ServiceRegistry(db);
    gitAdapter = new GitAdapter(testRepoPath);
  });

  afterEach(async () => {
    // Clean up after each test
    if (gitAdapter) {
      await gitAdapter.cleanup();
    }
  });

  describe('GitAdapter Service Registration', () => {
    it('should register GitAdapter as a service', async () => {
      await registry.register(gitAdapter);
      
      const services = registry.getServices();
      const gitService = services.find(s => s.name === 'git');
      
      expect(gitService).toBeDefined();
      expect(gitService?.status).toBe('active');
      expect(gitService?.capabilities).toContainEqual(expect.objectContaining({
        name: 'status'
      }));
    });

    it('should expose Git capabilities correctly', async () => {
      const capabilities = await gitAdapter.getCapabilities();
      
      expect(capabilities).toContainEqual(expect.objectContaining({ name: 'init' }));
      expect(capabilities).toContainEqual(expect.objectContaining({ name: 'add' }));
      expect(capabilities).toContainEqual(expect.objectContaining({ name: 'commit' }));
      expect(capabilities).toContainEqual(expect.objectContaining({ name: 'status' }));
      expect(capabilities).toContainEqual(expect.objectContaining({ name: 'log' }));
      expect(capabilities).toContainEqual(expect.objectContaining({ name: 'diff' }));
    });
  });

  describe('Git Operations via Service Registry', () => {
    beforeEach(async () => {
      await registry.register(gitAdapter);
    });

    it('should execute git status through service registry', async () => {
      const result = await registry.execute('git', {
        tool: 'status',
        args: {}
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should add and commit files through service registry', async () => {
      // Create a test file
      const testFile = join(testRepoPath, 'test.txt');
      writeFileSync(testFile, 'Hello, world!');

      // Add file
      const addResult = await registry.execute('git', {
        tool: 'add',
        args: { files: ['test.txt'] }
      });

      expect(addResult.success).toBe(true);

      // Commit file
      const commitResult = await registry.execute('git', {
        tool: 'commit',
        args: { message: 'Add test file' }
      });

      expect(commitResult.success).toBe(true);
      expect(commitResult.data).toHaveProperty('hash');
      expect(commitResult.data).toHaveProperty('message', 'Add test file');
    });

    it('should get commit log through service registry', async () => {
      // Create and commit a file first
      const testFile = join(testRepoPath, 'log-test.txt');
      writeFileSync(testFile, 'Log test content');

      await registry.execute('git', {
        tool: 'add',
        args: { files: ['log-test.txt'] }
      });

      await registry.execute('git', {
        tool: 'commit',
        args: { message: 'Add log test file' }
      });

      // Get log
      const logResult = await registry.execute('git', {
        tool: 'log',
        args: { limit: 5 }
      });

      expect(logResult.success).toBe(true);
      expect(logResult.data).toHaveProperty('groupedCommits');
      expect(Array.isArray(logResult.data.groupedCommits)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await registry.register(gitAdapter);
    });

    it('should handle invalid git operations gracefully', async () => {
      const result = await registry.execute('git', {
        tool: 'invalid-action',
        args: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown git tool');
    });

    it('should handle missing commit message', async () => {
      const result = await registry.execute('git', {
        tool: 'commit',
        args: { message: '' }
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Commit message is required');
    });
  });

  describe('MCP Tool Interface Compatibility', () => {
    it('should provide MCP-compatible tool definition', async () => {
      const capabilities = await gitAdapter.getCapabilities();
      
      // This should match the structure expected by MCP
      const toolDefinition = {
        name: 'git_operation',
        description: 'Execute Git operations through MPCM-Pro orchestration',
        inputSchema: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: capabilities.map(cap => cap.name),
              description: 'Git action to perform'
            },
            args: {
              type: 'object',
              description: 'Arguments for the Git operation'
            },
            repositoryPath: {
              type: 'string',
              description: 'Path to the Git repository'
            }
          },
          required: ['action']
        }
      };

      expect(toolDefinition.name).toBe('git_operation');
      expect(toolDefinition.inputSchema.properties.action.enum).toContain('status');
      expect(toolDefinition.inputSchema.properties.action.enum).toContain('commit');
    });
  });
});

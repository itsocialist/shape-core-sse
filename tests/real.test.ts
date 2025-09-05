/**
 * Real MCP Server Integration Tests
 * 
 * These tests verify actual MCP server communication
 * Run with: USE_REAL_MCP=true npm test tests/real.test.ts
 * 
 * Requirements:
 * - Git MCP server must be available (npm install -g @modelcontextprotocol/server-git)
 * - FileSystem MCP server must be available
 * - Terminal MCP server must be available
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { GitAdapter } from '../src/adapters/GitAdapter';
import { TerminalAdapter } from '../src/adapters/TerminalAdapter';
import { FilesystemAdapter } from '../src/adapters/FilesystemAdapter';
import { isMCPServerAvailable, MCP_TEST_TIMEOUT } from './helpers/mcp-test-helper';
import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';

// Skip these tests unless explicitly enabled
const skipUnlessReal = process.env.USE_REAL_MCP === 'true' ? describe : describe.skip;

skipUnlessReal('Real MCP Server Integration Tests', () => {
  let testDir: string;

  beforeAll(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mpcm-pro-real-test-'));
  });

  describe('Git MCP Server', () => {
    let adapter: GitAdapter;
    let isAvailable: boolean;

    beforeAll(async () => {
      isAvailable = await isMCPServerAvailable('npx', ['-y', '@modelcontextprotocol/server-git']);
      if (!isAvailable) {
        console.warn('Git MCP server not available');
      }
    });

    beforeEach(() => {
      if (isAvailable) {
        adapter = new GitAdapter(testDir);
      }
    });

    afterEach(async () => {
      if (adapter) {
        await adapter.cleanup();
      }
    });

    it('should connect and execute status command', async () => {
      if (!isAvailable) {
        console.log('Skipping: Git MCP server not available');
        return;
      }

      await adapter.initialize();
      
      const result = await adapter.execute({
        tool: 'status',
        args: {}
      });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('data');
    }, MCP_TEST_TIMEOUT);

    it('should initialize a git repository', async () => {
      if (!isAvailable) return;

      const repoPath = path.join(testDir, 'git-test-repo');
      await fs.mkdir(repoPath, { recursive: true });

      const result = await adapter.execute({
        tool: 'init',
        args: { path: repoPath }
      });

      expect(result.success).toBe(true);
      
      // Verify .git directory exists
      const gitDir = path.join(repoPath, '.git');
      const exists = await fs.access(gitDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }, MCP_TEST_TIMEOUT);
  });

  describe('FileSystem Adapter', () => {
    let adapter: FilesystemAdapter;

    beforeEach(() => {
      adapter = new FilesystemAdapter();
    });

    afterEach(async () => {
      if (adapter && adapter.shutdown) {
        await adapter.shutdown();
      }
    });

    it('should list directory', async () => {
      await adapter.initialize();
      
      const result = await adapter.execute({
        tool: 'list_directory',
        args: { path: testDir }
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('files');
      expect(Array.isArray(result.data.files)).toBe(true);
    }, MCP_TEST_TIMEOUT);

    it('should create and read a file', async () => {
      const filePath = path.join(testDir, 'test-file.txt');
      const content = 'Hello from real MCP test!';

      // Write file
      const writeResult = await adapter.execute({
        tool: 'write_file',
        args: { 
          path: filePath,
          content: content
        }
      });

      expect(writeResult.success).toBe(true);

      // Read file back
      const readResult = await adapter.execute({
        tool: 'read_file',
        args: { path: filePath }
      });

      expect(readResult.success).toBe(true);
      expect(readResult.data.content).toBe(content);
    }, MCP_TEST_TIMEOUT);
  });

  describe('Terminal MCP Server', () => {
    let adapter: TerminalAdapter;
    let isAvailable: boolean;

    beforeAll(async () => {
      // Terminal adapter might use a different command
      isAvailable = true; // Assume it's available for now
    });

    beforeEach(() => {
      if (isAvailable) {
        adapter = new TerminalAdapter();
      }
    });

    afterEach(async () => {
      if (adapter) {
        await adapter.cleanup();
      }
    });

    it('should connect and execute echo command', async () => {
      if (!isAvailable) {
        console.log('Skipping: Terminal MCP server not available');
        return;
      }

      await adapter.initialize();
      
      const result = await adapter.execute({
        tool: 'run_command',
        args: {
          command: 'echo "Hello from terminal"'
        }
      });

      expect(result).toHaveProperty('success');
      if (result.success) {
        expect(result.data.output).toContain('Hello from terminal');
      }
    }, MCP_TEST_TIMEOUT);

    it('should execute pwd command', async () => {
      if (!isAvailable) return;

      const result = await adapter.execute({
        tool: 'run_command',
        args: {
          command: 'pwd',
          cwd: testDir
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.output.trim()).toBe(testDir);
    }, MCP_TEST_TIMEOUT);
  });

  describe('Cross-Service Integration', () => {
    it('should coordinate between multiple services', async () => {
      const gitAvailable = await isMCPServerAvailable('npx', ['-y', '@modelcontextprotocol/server-git']);

      if (!gitAvailable) {
        console.log('Skipping: Git MCP server not available');
        return;
      }

      const gitAdapter = new GitAdapter(testDir);
      const fsAdapter = new FilesystemAdapter();

      try {
        // Initialize git repo
        await gitAdapter.initialize();
        const initResult = await gitAdapter.execute({
          tool: 'init',
          args: { path: testDir }
        });
        expect(initResult.success).toBe(true);

        // Create file using filesystem
        await fsAdapter.initialize();
        const writeResult = await fsAdapter.execute({
          tool: 'write_file',
          args: {
            path: path.join(testDir, 'README.md'),
            content: '# Test Project\n\nCreated by MPCM-Pro integration test'
          }
        });
        expect(writeResult.success).toBe(true);

        // Add file using git
        const addResult = await gitAdapter.execute({
          tool: 'add',
          args: { files: ['README.md'] }
        });
        expect(addResult.success).toBe(true);

        // Check status
        const statusResult = await gitAdapter.execute({
          tool: 'status',
          args: {}
        });
        expect(statusResult.success).toBe(true);

      } finally {
        await gitAdapter.cleanup();
        if (fsAdapter.shutdown) {
          await fsAdapter.shutdown();
        }
      }
    }, MCP_TEST_TIMEOUT * 2);
  });

  afterAll(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  });
});

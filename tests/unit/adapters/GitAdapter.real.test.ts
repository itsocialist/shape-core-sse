/**
 * @file GitAdapter.real.test.ts
 * @description Mocked Git MCP integration tests for GitAdapter
 */

import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { GitAdapter } from '../../../src/adapters/GitAdapter.js';
import { ServiceCommand } from '../../../src/types/ServiceTypes.js';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

// Create proper mocks for MCP SDK
const mockMcpClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  callTool: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined)
};

const mockMcpTransport = {
  close: jest.fn().mockResolvedValue(undefined)
};

// Mock the MCP SDK modules
jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn().mockImplementation(() => mockMcpClient)
}));

jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: jest.fn().mockImplementation(() => mockMcpTransport)
}));

describe('GitAdapter - Mocked MCP Integration', () => {
  let gitAdapter: GitAdapter;
  let testRepoPath: string;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create a temporary test repository
    testRepoPath = path.join(process.cwd(), 'test-temp-repo');
    
    // Clean up any existing test repo
    try {
      await fs.rm(testRepoPath, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }
    
    // Create test directory
    await fs.mkdir(testRepoPath, { recursive: true });
    
    // Initialize git repo
    execSync('git init', { cwd: testRepoPath });
    execSync('git config user.name "Test User"', { cwd: testRepoPath });
    execSync('git config user.email "test@example.com"', { cwd: testRepoPath });
    
    // Create GitAdapter with injected mock client
    gitAdapter = new GitAdapter({
      repositoryPath: testRepoPath,
      mcpClient: mockMcpClient,
      mcpTransport: mockMcpTransport
    });
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

  describe('Basic Functionality', () => {
    test('should initialize and get capabilities', async () => {
      expect(gitAdapter.getName()).toBe('git');
      const capabilities = await gitAdapter.getCapabilities();
      expect(capabilities).toHaveLength(10);
      expect(capabilities[0]).toEqual(expect.objectContaining({ 
        name: 'init', 
        description: 'Initialize a new Git repository' 
      }));
    });

    test('should get git status through mocked MCP', async () => {
      // Mock the status response
      mockMcpClient.callTool.mockResolvedValueOnce({
        content: [{
          text: JSON.stringify({
            staged_files: [],
            untracked_files: ['test.txt'],
            modified_files: []
          })
        }]
      });

      // Create a test file
      const testFile = path.join(testRepoPath, 'test.txt');
      await fs.writeFile(testFile, 'Hello World');

      const command: ServiceCommand = {
        tool: 'status',
        args: {}
      };

      const result = await gitAdapter.execute(command);

      expect(result.success).toBe(true);
      expect(result.data.untracked_files).toContain('test.txt');
      expect(mockMcpClient.callTool).toHaveBeenCalledWith({
        name: 'git_status',
        arguments: { repository: testRepoPath }
      });
    });

    test('should add files through mocked MCP', async () => {
      // Mock the add response
      mockMcpClient.callTool.mockResolvedValueOnce({
        content: [{
          text: JSON.stringify({
            added: ['test.txt'],
            message: 'Added 1 files to staging'
          })
        }]
      });

      const command: ServiceCommand = {
        tool: 'add',
        args: {
          files: ['test.txt']
        }
      };

      const result = await gitAdapter.execute(command);

      expect(result.success).toBe(true);
      expect(result.data.added).toContain('test.txt');
      expect(mockMcpClient.callTool).toHaveBeenCalledWith({
        name: 'git_add',
        arguments: { 
          repo_path: testRepoPath,
          files: ['test.txt'] 
        }
      });
    });

    test('should commit changes through mocked MCP', async () => {
      // Mock the commit response
      mockMcpClient.callTool.mockResolvedValueOnce({
        content: [{
          text: JSON.stringify({
            message: 'Add test file',
            hash: 'abc123def456',
            files: []
          })
        }]
      });

      const command: ServiceCommand = {
        tool: 'commit',
        args: {
          message: 'Add test file'
        }
      };

      const result = await gitAdapter.execute(command);

      expect(result.success).toBe(true);
      expect(result.data.message).toBe('Add test file');
      expect(result.data.hash).toBe('abc123def456');
      expect(mockMcpClient.callTool).toHaveBeenCalledWith({
        name: 'git_commit',
        arguments: { 
          repo_path: testRepoPath,
          message: 'Add test file'
        }
      });
    });

    test('should get git log through mocked MCP', async () => {
      // Mock the log response
      mockMcpClient.callTool.mockResolvedValueOnce({
        content: [{
          text: JSON.stringify({
            groupedCommits: [{
              hash: 'abc123',
              message: 'Initial commit',
              author: 'Test User',
              date: '2025-07-20'
            }]
          })
        }]
      });

      const command: ServiceCommand = {
        tool: 'log',
        args: { limit: 5 }
      };

      const result = await gitAdapter.execute(command);

      expect(result.success).toBe(true);
      expect(result.data.groupedCommits).toBeDefined();
      expect(Array.isArray(result.data.groupedCommits)).toBe(true);
      expect(result.data.groupedCommits.length).toBeGreaterThan(0);
      expect(mockMcpClient.callTool).toHaveBeenCalledWith({
        name: 'git_log',
        arguments: { 
          repository: testRepoPath,
          max_count: 5
        }
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle empty commit message', async () => {
      const command: ServiceCommand = {
        tool: 'commit',
        args: {
          message: '' // Invalid: empty commit message
        }
      };

      const result = await gitAdapter.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Commit message is required');
      // Should not call MCP with invalid message
      expect(mockMcpClient.callTool).not.toHaveBeenCalled();
    });

    test('should handle unknown git actions', async () => {
      const command: ServiceCommand = {
        tool: 'invalidaction',
        args: {}
      };

      const result = await gitAdapter.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown git tool: invalidaction');
      expect(mockMcpClient.callTool).not.toHaveBeenCalled();
    });

    test('should handle MCP client errors gracefully', async () => {
      // Mock MCP client to throw error
      mockMcpClient.callTool.mockRejectedValueOnce(new Error('MCP server unavailable'));

      const command: ServiceCommand = {
        tool: 'status',
        args: {}
      };

      const result = await gitAdapter.execute(command);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to get repository status');
      expect(result.error).toContain('MCP server unavailable');
    });
  });

  describe('Client Management', () => {
    test('should use injected client without connecting', async () => {
      // Execute an operation
      mockMcpClient.callTool.mockResolvedValueOnce({
        content: [{ text: '{"staged_files": []}' }]
      });

      await gitAdapter.execute({ tool: 'status', args: {} });
      
      // Should not try to connect since client was injected
      expect(mockMcpClient.connect).not.toHaveBeenCalled();
      expect(mockMcpClient.callTool).toHaveBeenCalled();
    });

    test('should cleanup without errors', async () => {
      await expect(gitAdapter.cleanup()).resolves.not.toThrow();
      expect(mockMcpTransport.close).not.toHaveBeenCalled(); // Not called for injected clients
    });

    test('should handle multiple operations with same client', async () => {
      // Mock responses for multiple calls
      mockMcpClient.callTool
        .mockResolvedValueOnce({ content: [{ text: '{"staged_files": []}' }] })
        .mockResolvedValueOnce({ content: [{ text: '{"staged_files": []}' }] });

      const result1 = await gitAdapter.execute({ tool: 'status', args: {} });
      const result2 = await gitAdapter.execute({ tool: 'status', args: {} });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(mockMcpClient.callTool).toHaveBeenCalledTimes(2);
    });
  });

  describe('Response Parsing', () => {
    test('should handle string responses', async () => {
      mockMcpClient.callTool.mockResolvedValueOnce({
        content: [{ text: 'Simple string response' }]
      });

      const result = await gitAdapter.execute({ tool: 'status', args: {} });
      expect(result.success).toBe(true);
      expect(result.data).toBe('Simple string response');
    });

    test('should handle object responses', async () => {
      const responseObj = { staged_files: [], modified_files: ['test.txt'] };
      mockMcpClient.callTool.mockResolvedValueOnce({
        content: [{ text: responseObj }] // Already an object
      });

      const result = await gitAdapter.execute({ tool: 'status', args: {} });
      expect(result.success).toBe(true);
      expect(result.data).toEqual(responseObj);
    });

    test('should handle empty responses', async () => {
      mockMcpClient.callTool.mockResolvedValueOnce({
        content: [{ text: '' }]
      });

      const result = await gitAdapter.execute({ tool: 'status', args: {} });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No response from git status');
    });
  });
});

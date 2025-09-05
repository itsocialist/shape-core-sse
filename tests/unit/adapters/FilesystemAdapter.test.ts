/**
 * Unit tests for FilesystemAdapter
 * Tests the adapter wrapper for FilesystemServiceProvider
 */

import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { FilesystemAdapter } from '../../../src/adapters/FilesystemAdapter';
import { ServiceCommand } from '../../../src/adapters/base/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('FilesystemAdapter', () => {
  let adapter: FilesystemAdapter;
  let testDir: string;

  beforeEach(async () => {
    adapter = new FilesystemAdapter();
    testDir = path.join(os.tmpdir(), `fs-adapter-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await adapter.shutdown();
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Adapter Interface', () => {
    it('should implement BaseAdapter interface', () => {
      expect(adapter.getName).toBeDefined();
      expect(adapter.getDescription).toBeDefined();
      expect(adapter.initialize).toBeDefined();
      expect(adapter.getCapabilities).toBeDefined();
      expect(adapter.execute).toBeDefined();
      expect(adapter.shutdown).toBeDefined();
    });

    it('should return correct name', () => {
      expect(adapter.getName()).toBe('filesystem');
    });

    it('should return correct description', () => {
      expect(adapter.getDescription()).toBe('Filesystem operations for project management');
    });

    it('should initialize successfully', async () => {
      await expect(adapter.initialize()).resolves.not.toThrow();
    });

    it('should return capabilities', async () => {
      const capabilities = await adapter.getCapabilities();
      
      expect(capabilities).toHaveLength(5);
      expect(capabilities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'create_directory' }),
          expect.objectContaining({ name: 'write_file' }),
          expect.objectContaining({ name: 'read_file' }),
          expect.objectContaining({ name: 'list_directory' }),
          expect.objectContaining({ name: 'delete_file' })
        ])
      );
    });
  });

  describe('File Operations', () => {
    it('should create directory', async () => {
      const dirPath = path.join(testDir, 'new-dir');
      const command: ServiceCommand = {
        tool: 'create_directory',
        args: { path: dirPath }
      };

      const result = await adapter.execute(command);
      
      expect(result.success).toBe(true);
      expect(result.data.path).toBe(dirPath);
      
      // Verify directory exists
      const stats = await fs.stat(dirPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should write file', async () => {
      const filePath = path.join(testDir, 'test.txt');
      const content = 'Hello from FilesystemAdapter';
      const command: ServiceCommand = {
        tool: 'write_file',
        args: { path: filePath, content }
      };

      const result = await adapter.execute(command);
      
      expect(result.success).toBe(true);
      expect(result.data.path).toBe(filePath);
      expect(result.data.size).toBe(content.length);
      
      // Verify file content
      const readContent = await fs.readFile(filePath, 'utf8');
      expect(readContent).toBe(content);
    });

    it('should read file', async () => {
      const filePath = path.join(testDir, 'read-test.txt');
      const content = 'Test content for reading';
      await fs.writeFile(filePath, content);

      const command: ServiceCommand = {
        tool: 'read_file',
        args: { path: filePath }
      };

      const result = await adapter.execute(command);
      
      expect(result.success).toBe(true);
      expect(result.data.content).toBe(content);
      expect(result.data.size).toBe(content.length);
    });

    it('should list directory', async () => {
      // Create test files and directories
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'content2');
      await fs.mkdir(path.join(testDir, 'subdir1'));
      await fs.mkdir(path.join(testDir, 'subdir2'));

      const command: ServiceCommand = {
        tool: 'list_directory',
        args: { path: testDir }
      };

      const result = await adapter.execute(command);
      
      expect(result.success).toBe(true);
      expect(result.data.files).toHaveLength(2);
      expect(result.data.files).toEqual(
        expect.arrayContaining(['file1.txt', 'file2.txt'])
      );
      expect(result.data.directories).toHaveLength(2);
      expect(result.data.directories).toEqual(
        expect.arrayContaining(['subdir1', 'subdir2'])
      );
    });

    it('should delete file', async () => {
      const filePath = path.join(testDir, 'delete-me.txt');
      await fs.writeFile(filePath, 'temporary content');

      const command: ServiceCommand = {
        tool: 'delete_file',
        args: { path: filePath }
      };

      const result = await adapter.execute(command);
      
      expect(result.success).toBe(true);
      expect(result.data.path).toBe(filePath);
      
      // Verify file is deleted
      await expect(fs.access(filePath)).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown tool', async () => {
      const command: ServiceCommand = {
        tool: 'unknown_tool',
        args: {}
      };

      const result = await adapter.execute(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown filesystem action');
    });

    it('should handle missing required arguments', async () => {
      const command: ServiceCommand = {
        tool: 'write_file',
        args: { path: path.join(testDir, 'test.txt') } // Missing content
      };

      const result = await adapter.execute(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should handle file not found', async () => {
      const command: ServiceCommand = {
        tool: 'read_file',
        args: { path: path.join(testDir, 'nonexistent.txt') }
      };

      const result = await adapter.execute(command);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to read file');
    });

    it('should handle permission errors gracefully', async () => {
      // This test might not work on all systems
      const protectedPath = '/root/test.txt'; // Usually protected
      const command: ServiceCommand = {
        tool: 'write_file',
        args: { path: protectedPath, content: 'test' }
      };

      const result = await adapter.execute(command);
      
      expect(result.success).toBe(false);
      // Error message will vary by system
    });
  });

  describe('Edge Cases', () => {
    it('should create nested directories', async () => {
      const nestedPath = path.join(testDir, 'a', 'b', 'c', 'd');
      const command: ServiceCommand = {
        tool: 'create_directory',
        args: { path: nestedPath }
      };

      const result = await adapter.execute(command);
      
      expect(result.success).toBe(true);
      const stats = await fs.stat(nestedPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should handle empty directory listing', async () => {
      const emptyDir = path.join(testDir, 'empty');
      await fs.mkdir(emptyDir);

      const command: ServiceCommand = {
        tool: 'list_directory',
        args: { path: emptyDir }
      };

      const result = await adapter.execute(command);
      
      expect(result.success).toBe(true);
      expect(result.data.files).toHaveLength(0);
      expect(result.data.directories).toHaveLength(0);
    });

    it('should overwrite existing file', async () => {
      const filePath = path.join(testDir, 'overwrite.txt');
      await fs.writeFile(filePath, 'original content');

      const command: ServiceCommand = {
        tool: 'write_file',
        args: { path: filePath, content: 'new content' }
      };

      const result = await adapter.execute(command);
      
      expect(result.success).toBe(true);
      const content = await fs.readFile(filePath, 'utf8');
      expect(content).toBe('new content');
    });
  });
});

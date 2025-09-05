/**
 * Integration test for cross-service coordination
 * Demonstrates how Git and Terminal adapters work together through the Service Registry
 */

import { ServiceRegistry } from '../../src/orchestration/registry/ServiceRegistry';
import { FilesystemAdapter } from '../../src/adapters/FilesystemAdapter';
import { MockGitAdapter, MockTerminalAdapter } from '../mocks/adapters';
import { DatabaseManager } from '../../src/db/database.js';
import { ServiceCommand } from '../../src/adapters/base/types';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Cross-Service Coordination', () => {
  let registry: ServiceRegistry;
  let db: DatabaseManager;
  let testDir: string;

  beforeEach(async () => {
    // Create a test directory
    testDir = path.join(os.tmpdir(), `mpcm-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Initialize database
    db = new DatabaseManager(':memory:');
    await db.initialize();

    // Create service registry
    registry = new ServiceRegistry(db);

    // Register adapters
    await registry.register(new FilesystemAdapter());
    await registry.register(new MockGitAdapter(testDir));
    await registry.register(new MockTerminalAdapter());
  });

  afterEach(async () => {
    // Cleanup
    await registry.shutdown();
    await db.close();
    
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up test directory:', error);
    }
  });

  describe('Service Registration', () => {
    it('should have all services registered', () => {
      const services = registry.getServices();
      
      expect(services).toHaveLength(3);
      expect(services.map(s => s.name)).toEqual(
        expect.arrayContaining(['filesystem', 'git', 'terminal'])
      );
    });

    it('should have all services active', () => {
      const services = registry.getServices();
      
      for (const service of services) {
        expect(service.status).toBe('active');
      }
    });
  });

  describe('Coordinated Workflow: Create Project', () => {
    it('should create a new project using multiple services', async () => {
      // Step 1: Use filesystem to create project structure
      const createDirCommand: ServiceCommand = {
        tool: 'create_directory',
        args: { path: path.join(testDir, 'src') },
        projectName: 'test-project',
        storeResult: true
      };
      
      const dirResult = await registry.execute('filesystem', createDirCommand);
      expect(dirResult.success).toBe(true);

      // Step 2: Create a README file
      const createFileCommand: ServiceCommand = {
        tool: 'write_file',
        args: {
          path: path.join(testDir, 'README.md'),
          content: '# Test Project\n\nCreated by MPCM-Pro cross-service coordination'
        },
        projectName: 'test-project',
        storeResult: true
      };
      
      const fileResult = await registry.execute('filesystem', createFileCommand);
      expect(fileResult.success).toBe(true);

      // Step 3: Initialize Git repository
      const gitInitCommand: ServiceCommand = {
        tool: 'init',
        args: {},
        projectName: 'test-project',
        storeResult: true
      };
      
      const gitResult = await registry.execute('git', gitInitCommand);
      expect(gitResult.success).toBe(true);

      // Step 4: Add files to Git
      const gitAddCommand: ServiceCommand = {
        tool: 'add',
        args: { files: ['.'] },
        projectName: 'test-project',
        storeResult: true
      };
      
      const addResult = await registry.execute('git', gitAddCommand);
      expect(addResult.success).toBe(true);

      // Step 5: Commit changes
      const gitCommitCommand: ServiceCommand = {
        tool: 'commit',
        args: { message: 'Initial commit - Project created by MPCM-Pro' },
        projectName: 'test-project',
        storeResult: true
      };
      
      const commitResult = await registry.execute('git', gitCommitCommand);
      expect(commitResult.success).toBe(true);

      // Step 6: Verify using terminal
      const terminalCommand: ServiceCommand = {
        tool: 'execute',
        args: {
          command: 'ls -la && git log --oneline',
          cwd: testDir,
          timeout: 5000
        },
        projectName: 'test-project',
        storeResult: true
      };
      
      const terminalResult = await registry.execute('terminal', terminalCommand);
      expect(terminalResult.success).toBe(true);
      expect(terminalResult.data.output).toContain('README.md');
      expect(terminalResult.data.output).toContain('Initial commit');
    });
  });

  describe('Error Handling', () => {
    it('should handle service not found', async () => {
      const command: ServiceCommand = {
        tool: 'test',
        args: {}
      };
      
      await expect(
        registry.execute('nonexistent', command)
      ).rejects.toThrow('Service nonexistent not found');
    });

    it('should handle unknown tool', async () => {
      const command: ServiceCommand = {
        tool: 'unknown_tool',
        args: {}
      };
      
      const result = await registry.execute('terminal', command);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown terminal tool');
    });
  });

  describe('Service Status', () => {
    it('should track service errors', async () => {
      // Force an error by using invalid arguments
      const command: ServiceCommand = {
        tool: 'execute',
        args: {} // Missing required 'command' argument
      };
      
      const result = await registry.execute('terminal', command);
      expect(result.success).toBe(false);
      
      // Service should still be active (recoverable error)
      const service = registry.getService('terminal');
      expect(service?.status).toBe('active');
    });
  });
});

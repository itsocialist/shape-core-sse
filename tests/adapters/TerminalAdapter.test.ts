/**
 * TerminalAdapter Tests
 * Tests both mocked (unit) and real (integration) modes
 * Use USE_REAL_MCP=true environment variable to run integration tests
 */

import { TerminalAdapter } from '../../src/adapters/TerminalAdapter';
import { describe, beforeEach, afterEach, it, expect, jest, beforeAll } from '@jest/globals';
import { ServiceCommand } from '../../src/adapters/base/types';
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

describe('TerminalAdapter', () => {
  /**
   * Unit Tests - Run with mocked MCP client/transport
   */
  describeWithMock('Unit Tests (Mocked)', () => {
    let adapter: TerminalAdapter;
    let mockClient: ReturnType<typeof createMockMCP>['client'];
    let mockTransport: ReturnType<typeof createMockMCP>['transport'];

    beforeEach(() => {
      // Create mocks
      const mocks = createMockMCP();
      mockClient = mocks.client;
      mockTransport = mocks.transport;

      // Create adapter with injected mocks
      adapter = new TerminalAdapter({
        mcpClient: mockClient as any,
        mcpTransport: mockTransport as any
      });

      // Mock console.error to suppress logs in tests
      jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(async () => {
      await adapter.cleanup();
      jest.restoreAllMocks();
    });

    describe('Basic Properties', () => {
      it('should have correct name', () => {
        expect(adapter.getName()).toBe('terminal');
      });

      it('should have correct description', () => {
        expect(adapter.getDescription()).toBe('Terminal command execution via Desktop Commander MCP');
      });

      it('should return capabilities', async () => {
        const capabilities = await adapter.getCapabilities();
        expect(capabilities).toHaveLength(5);
        expect(capabilities.map(c => c.name)).toEqual([
          'execute',
          'read_output',
          'list_sessions',
          'kill_session',
          'check_command'
        ]);
      });
    });

    describe('Command Execution', () => {
      it('should execute simple command', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success('Command started with PID 1234\nInitial output:\nhello')
        );

        const command: ServiceCommand = {
          tool: 'execute',
          args: {
            command: 'echo hello',
            timeout: 5000
          }
        };

        const result = await adapter.execute(command);

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
          output: expect.stringContaining('hello'),
          exitCode: 0,
          timedOut: false
        });
        expect(mockClient.callTool).toHaveBeenCalledWith({
          name: 'execute_command',
          arguments: {
            command: 'echo hello',
            timeout_ms: 5000
          }
        });
      });

      it('should handle command with working directory', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success('Command started with PID 1234\nInitial output:\n/tmp')
        );

        const command: ServiceCommand = {
          tool: 'execute',
          args: {
            command: 'pwd',
            cwd: '/tmp',
            timeout: 5000
          }
        };

        const result = await adapter.execute(command);

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
          output: expect.stringContaining('/tmp'),
          cwd: '/tmp'
        });
        expect(mockClient.callTool).toHaveBeenCalledWith({
          name: 'execute_command',
          arguments: {
            command: 'cd "/tmp" && pwd',
            timeout_ms: 5000
          }
        });
      });

      it('should detect exit codes', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success('Command failed\nExit code: 127')
        );

        const command: ServiceCommand = {
          tool: 'execute',
          args: {
            command: 'nonexistent-command',
            timeout: 5000
          }
        };

        const result = await adapter.execute(command);

        expect(result.success).toBe(true);
        expect(result.data.exitCode).toBe(127);
      });

      it('should handle timeout', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success('Command started with PID 1234\nCommand timed out after 100ms')
        );

        const command: ServiceCommand = {
          tool: 'execute',
          args: {
            command: 'sleep 10',
            timeout: 100
          }
        };

        const result = await adapter.execute(command);

        expect(result.success).toBe(true);
        expect(result.data.timedOut).toBe(true);
      });

      it('should track long-running sessions', async () => {
        mockClient.callTool.mockResolvedValueOnce(
          MCPResponseBuilders.success('Command started with PID 1234\nCommand continues running')
        );

        await adapter.execute({
          tool: 'execute',
          args: {
            command: 'sleep 60',
            timeout: 1000
          }
        });

        // Mock list sessions response
        mockClient.callTool.mockResolvedValueOnce(
          MCPResponseBuilders.success('Active sessions:\nPID: 1234')
        );

        const listResult = await adapter.execute({
          tool: 'list_sessions',
          args: {}
        });

        expect(listResult.success).toBe(true);
        expect(listResult.data.count).toBe(1);
        expect(listResult.data.sessions[0]).toMatchObject({
          pid: 1234,
          command: 'sleep 60'
        });
      });
    });

    describe('Session Management', () => {
      it('should read output from running command', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success('Additional output from process')
        );

        const command: ServiceCommand = {
          tool: 'read_output',
          args: {
            pid: 1234,
            timeout: 1000
          }
        };

        const result = await adapter.execute(command);

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
          pid: 1234,
          output: 'Additional output from process'
        });
        expect(mockClient.callTool).toHaveBeenCalledWith({
          name: 'read_output',
          arguments: {
            pid: 1234,
            timeout_ms: 1000
          }
        });
      });

      it('should kill session', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success('Process 1234 terminated')
        );

        const command: ServiceCommand = {
          tool: 'kill_session',
          args: {
            pid: 1234
          }
        };

        const result = await adapter.execute(command);

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
          pid: 1234,
          message: 'Process 1234 terminated'
        });
        expect(mockClient.callTool).toHaveBeenCalledWith({
          name: 'force_terminate',
          arguments: { pid: 1234 }
        });
      });
    });

    describe('Command Checking', () => {
      it('should check if command exists', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success('/usr/bin/git')
        );

        const command: ServiceCommand = {
          tool: 'check_command',
          args: {
            command: 'git'
          }
        };

        const result = await adapter.execute(command);

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
          command: 'git',
          exists: true,
          path: '/usr/bin/git'
        });
      });

      it('should handle non-existent command', async () => {
        mockClient.callTool.mockResolvedValue(
          MCPResponseBuilders.success('Command failed\nExit code: 1')
        );

        const command: ServiceCommand = {
          tool: 'check_command',
          args: {
            command: 'nonexistent-command'
          }
        };

        const result = await adapter.execute(command);

        expect(result.success).toBe(true);
        expect(result.data).toMatchObject({
          command: 'nonexistent-command',
          exists: false,
          path: null
        });
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
        expect(result.error).toContain('Unknown terminal tool: unknown_tool');
      });

      it('should handle missing command', async () => {
        const command: ServiceCommand = {
          tool: 'execute',
          args: {}
        };

        const result = await adapter.execute(command);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Command is required');
      });

      it('should handle missing PID for read_output', async () => {
        const command: ServiceCommand = {
          tool: 'read_output',
          args: {}
        };

        const result = await adapter.execute(command);

        expect(result.success).toBe(false);
        expect(result.error).toContain('PID is required');
      });

      it('should handle MCP call failures gracefully', async () => {
        mockClient.callTool.mockRejectedValue(new Error('MCP connection failed'));

        const command: ServiceCommand = {
          tool: 'execute',
          args: {
            command: 'echo test',
            timeout: 5000
          }
        };

        const result = await adapter.execute(command);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Command execution failed');
      });
    });

    describe('Cleanup', () => {
      it('should not close injected transport on cleanup', async () => {
        await adapter.initialize();
        await adapter.cleanup();
        
        // Injected transport should NOT be closed
        expect(mockTransport.close).not.toHaveBeenCalled();
      });

      it('should clean up active sessions on shutdown', async () => {
        // Start a long-running command
        mockClient.callTool.mockResolvedValueOnce(
          MCPResponseBuilders.success('Command started with PID 1234\nCommand continues running')
        );

        await adapter.execute({
          tool: 'execute',
          args: {
            command: 'sleep 60',
            timeout: 1000
          }
        });

        // Clear the mock to track only cleanup calls
        mockClient.callTool.mockClear();

        // Mock kill response
        mockClient.callTool.mockResolvedValueOnce(
          MCPResponseBuilders.success('Process 1234 terminated')
        );

        await adapter.cleanup();

        // Should have called force_terminate during cleanup
        expect(mockClient.callTool).toHaveBeenCalledTimes(1);
        expect(mockClient.callTool).toHaveBeenCalledWith({
          name: 'force_terminate',
          arguments: { pid: 1234 }
        });
      });
    });
  });

  /**
   * Integration Tests - Run with real Desktop Commander MCP
   * Set USE_REAL_MCP=true to enable these tests
   */
  describeWithMCP('Integration Tests (Real MCP)', () => {
    let adapter: TerminalAdapter;
    let isAvailable: boolean;

    beforeAll(async () => {
      // Check if Desktop Commander MCP is available
      isAvailable = await isMCPServerAvailable('npx', ['-y', '@wonderwhy-er/desktop-commander']);
      if (!isAvailable) {
        console.warn('Desktop Commander MCP not available, skipping integration tests');
      }
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

    it('should connect to real Desktop Commander MCP', async () => {
      if (!isAvailable) return;

      await adapter.initialize();
      
      const result = await adapter.execute({
        tool: 'execute',
        args: {
          command: 'echo "Hello from real MCP"',
          timeout: 5000
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.output).toContain('Hello from real MCP');
    }, MCP_TEST_TIMEOUT);

    it('should execute real commands', async () => {
      if (!isAvailable) return;

      const result = await adapter.execute({
        tool: 'execute',
        args: {
          command: 'pwd',
          timeout: 5000
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.output).toBeTruthy();
      expect(result.data.exitCode).toBe(0);
    }, MCP_TEST_TIMEOUT);

    it('should handle working directory', async () => {
      if (!isAvailable) return;

      const result = await adapter.execute({
        tool: 'execute',
        args: {
          command: 'pwd',
          cwd: '/tmp',
          timeout: 5000
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.output.trim()).toContain('/tmp');
    }, MCP_TEST_TIMEOUT);

    it('should check if commands exist', async () => {
      if (!isAvailable) return;

      // Check for a command that should exist
      const gitResult = await adapter.execute({
        tool: 'check_command',
        args: {
          command: 'ls'
        }
      });

      expect(gitResult.success).toBe(true);
      expect(gitResult.data.exists).toBe(true);
      expect(gitResult.data.path).toBeTruthy();

      // Check for a command that shouldn't exist
      const fakeResult = await adapter.execute({
        tool: 'check_command',
        args: {
          command: 'this-command-does-not-exist-12345'
        }
      });

      expect(fakeResult.success).toBe(true);
      expect(fakeResult.data.exists).toBe(false);
    }, MCP_TEST_TIMEOUT);

    it('should handle long-running commands and sessions', async () => {
      if (!isAvailable) return;

      // Start a command that will timeout
      const execResult = await adapter.execute({
        tool: 'execute',
        args: {
          command: 'sleep 5',
          timeout: 1000 // 1 second timeout
        }
      });

      expect(execResult.success).toBe(true);
      expect(execResult.data.timedOut).toBe(true);

      // List sessions to see if it's tracked
      const listResult = await adapter.execute({
        tool: 'list_sessions',
        args: {}
      });

      expect(listResult.success).toBe(true);
      // Session count may vary depending on system state
    }, MCP_TEST_TIMEOUT);
  });
});

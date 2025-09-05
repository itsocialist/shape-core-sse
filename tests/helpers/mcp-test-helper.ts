/**
 * MCP Test Helper
 * Provides utilities for testing MCP adapters with both mocked and real implementations
 */

import { jest } from '@jest/globals';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Environment variable to control test mode
export const USE_REAL_MCP = process.env.USE_REAL_MCP === 'true';
export const MCP_TEST_TIMEOUT = parseInt(process.env.MCP_TEST_TIMEOUT || '30000', 10);

export interface MockMCPClient {
  connect: jest.Mock;
  close: jest.Mock;
  callTool: jest.Mock;
  listTools?: jest.Mock;
  listResources?: jest.Mock;
}

export interface MockMCPTransport {
  close: jest.Mock;
}

/**
 * Creates mock MCP client and transport for unit testing
 */
export function createMockMCP(): { client: MockMCPClient; transport: MockMCPTransport } {
  const transport: MockMCPTransport = {
    close: jest.fn().mockResolvedValue(undefined)
  };

  const client: MockMCPClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
    callTool: jest.fn(),
    listTools: jest.fn().mockResolvedValue({ tools: [] }),
    listResources: jest.fn().mockResolvedValue({ resources: [] })
  };

  return { client, transport };
}

/**
 * Sets up MCP mocks for a test suite
 * @param mockImplementations - Optional specific implementations for mocked methods
 */
export function setupMCPMocks(mockImplementations?: {
  Client?: () => any;
  StdioClientTransport?: () => any;
}) {
  const { client, transport } = createMockMCP();
  
  // Mock the MCP SDK modules
  jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
    Client: jest.fn(() => mockImplementations?.Client?.() || client)
  }));
  
  jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
    StdioClientTransport: jest.fn(() => mockImplementations?.StdioClientTransport?.() || transport)
  }));
  
  return { client, transport };
}

/**
 * Conditionally skips tests based on USE_REAL_MCP environment variable
 */
export const describeWithMCP = USE_REAL_MCP ? describe : describe.skip;
export const describeWithMock = USE_REAL_MCP ? describe.skip : describe;

/**
 * Helper to check if required MCP server is available
 */
export async function isMCPServerAvailable(command: string, args: string[]): Promise<boolean> {
  if (!USE_REAL_MCP) return false;
  
  try {
    const { spawn } = await import('child_process');
    const child = spawn(command, [...args, '--version'], {
      stdio: 'ignore',
      timeout: 5000
    });
    
    return new Promise((resolve) => {
      child.on('close', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    });
  } catch {
    return false;
  }
}

/**
 * Cleanup helper for real MCP connections
 */
export async function cleanupMCPConnection(client: any, transport: any) {
  try {
    if (client?.close) {
      await client.close();
    }
  } catch (error) {
    // Ignore errors during cleanup
  }
  
  try {
    if (transport?.close) {
      await transport.close();
    }
  } catch (error) {
    // Ignore errors during cleanup
  }
}

/**
 * Test data builders for common MCP responses
 */
export const MCPResponseBuilders = {
  success: (data: any) => ({
    content: [{
      type: 'text',
      text: typeof data === 'string' ? data : JSON.stringify(data)
    }]
  }),
  
  error: (message: string) => ({
    error: {
      code: -32000,
      message
    }
  }),
  
  empty: () => ({
    content: []
  })
};

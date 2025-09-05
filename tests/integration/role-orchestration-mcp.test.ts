/**
 * Integration test for Role Orchestration MCP Tools
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MCPMProServer } from '../../src/index.js';
import { DatabaseManager } from '../../src/db/database.js';

describe('Role Orchestration MCP Integration', () => {
  let server: MCPMProServer;
  let db: DatabaseManager;

  beforeEach(async () => {
    db = await DatabaseManager.create(':memory:');
    server = new MCPMProServer(db);
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
    if (db) {
      db.close();
    }
  });

  it('should list available roles via MCP tool', async () => {
    const request = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'list_available_roles',
        arguments: {}
      },
      id: 1
    };

    const response = await server.handleRequest(request);
    
    expect(response.result).toBeDefined();
    expect(response.result.content[0].text).toContain('architect');
    expect(response.result.content[0].text).toContain('developer');
    
    const roles = JSON.parse(response.result.content[0].text);
    expect(roles).toHaveLength(5);
    expect(roles.map((r: any) => r.id)).toContain('architect');
  });

  it('should enhance prompt with role via MCP tool', async () => {
    const request = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'enhance_prompt_with_role',
        arguments: {
          prompt: 'Design a REST API',
          roleId: 'architect',
          projectName: 'test-project'
        }
      },
      id: 2
    };

    const response = await server.handleRequest(request);
    
    expect(response.result).toBeDefined();
    const enhancedPrompt = response.result.content[0].text;
    expect(enhancedPrompt).toContain('Software Architect');
    expect(enhancedPrompt).toContain('Design a REST API');
    expect(enhancedPrompt).toContain('test-project');
    expect(enhancedPrompt).toContain('architecture');
  });

  it('should execute as role via MCP tool with mock service', async () => {
    // First register a mock service
    const mockAdapter = {
      getName: () => 'mock-service',
      getDescription: () => 'Mock service for testing',
      initialize: async () => {},
      getCapabilities: async () => [
        { name: 'test', description: 'Test operation' }
      ],
      execute: async () => ({ success: true, data: 'mock result' }),
      shutdown: async () => {}
    };

    // Access the registry through server internals for testing
    await (server as any).registry.register(mockAdapter);

    const request = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'execute_as_role',
        arguments: {
          roleId: 'developer',
          serviceName: 'mock-service',
          tool: 'test',
          args: { input: 'test' },
          projectName: 'test-project'
        }
      },
      id: 3
    };

    const response = await server.handleRequest(request);
    
    expect(response.result).toBeDefined();
    const result = JSON.parse(response.result.content[0].text);
    expect(result.success).toBe(true);
    expect(result.data).toBe('mock result');
    expect(result.roleContext.roleId).toBe('developer');
    expect(result.roleContext.analysis).toContain('developer perspective');
  });

  it('should include role tools in tools list', async () => {
    const request = {
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
      id: 4
    };

    const response = await server.handleRequest(request);
    
    expect(response.result).toBeDefined();
    const tools = response.result.tools;
    const toolNames = tools.map((t: any) => t.name);
    
    expect(toolNames).toContain('execute_as_role');
    expect(toolNames).toContain('list_available_roles');
    expect(toolNames).toContain('enhance_prompt_with_role');
  });
});

/**
 * Unit tests for MPCM-Pro MCP Tools
 * Testing the actual interface exposed to Claude
 */

import { MCPMProServer } from '../../../src/index';
import { DatabaseManager } from '../../../src/db/database.js';
import { MockSuccessAdapter } from '../../../src/test-utils/mockAdapters';

describe('MPCM-Pro MCP Tools', () => {
  let server: MCPMProServer;
  let db: DatabaseManager;
  
  beforeEach(async () => {
    // Create test database
    db = await DatabaseManager.create(':memory:');
    server = new MCPMProServer(db);
    
    // Initialize with mock adapter
    const mockAdapter = new MockSuccessAdapter('test-service');
    await server['registry'].register(mockAdapter);
  });
  
  afterEach(async () => {
    // Clean shutdown without process.exit
    try {
      if (server['registry']) {
        await server['registry'].shutdown();
      }
      if (db && typeof db.close === 'function') {
        db.close();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('list_services tool', () => {
    it('should return list of registered services', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'list_services',
          arguments: {}
        },
        id: 1
      };
      
      const response = await server.handleRequest(request);
      
      expect(response.result).toBeDefined();
      const content = JSON.parse(response.result.content[0].text);
      expect(content.totalServices).toBe(1);
      expect(content.services[0].name).toBe('test-service');
    });
  });
  
  describe('execute_service tool', () => {
    it('should execute command on service', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'execute_service',
          arguments: {
            service: 'test-service',
            tool: 'test_command',
            args: { input: 'hello' }
          }
        },
        id: 2
      };
      
      const response = await server.handleRequest(request);
      
      expect(response.result).toBeDefined();
      const result = JSON.parse(response.result.content[0].text);
      expect(result.input).toEqual({ input: 'hello' });
    });
    
    it('should handle service not found', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'execute_service',
          arguments: {
            service: 'non-existent',
            tool: 'test',
            args: {}
          }
        },
        id: 3
      };
      
      const response = await server.handleRequest(request);
      
      // Response should be successful but contain error message in content
      expect(response.result).toBeDefined();
      expect(response.result.content[0].text).toContain('not found');
    });
  });
  
  describe('tools/list request', () => {
    it('should include orchestration tools', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 4
      };
      
      const response = await server.handleRequest(request);
      
      const tools = response.result.tools;
      const toolNames = tools.map((t: any) => t.name);
      
      expect(toolNames).toContain('execute_service');
      expect(toolNames).toContain('list_services');
      expect(toolNames).toContain('store_project_context');
    });
  });
});

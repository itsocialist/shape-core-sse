/**
 * MCP Protocol Integration Tests
 * Tests real Claude Desktop communication and MCP compliance
 */

import { MCPMProServer } from '../../src/index.js';
import { DatabaseManager } from '../../src/db/database.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

describe('MCP Protocol Integration', () => {
  let server: MCPMProServer;
  let db: DatabaseManager;

  beforeEach(async () => {
    // Use test database
    db = new DatabaseManager(':memory:');
    await db.initialize();
    
    server = new MCPMProServer({
      mode: 'pro',
      database: db
    });
    await server.initialize();
  });

  afterEach(async () => {
    await server?.close();
    await db?.close();
  });

  describe('Tool Discovery', () => {
    test('Claude Desktop can discover all tools', async () => {
      const tools = await server.listTools();
      
      expect(tools).toHaveLength(25); // Current tool count
      expect(tools.every(tool => tool.name && tool.description)).toBe(true);
    });

    test('All tools have valid MCP schemas', async () => {
      const tools = await server.listTools();
      
      for (const tool of tools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
        
        // Required fields should exist in properties
        if (tool.inputSchema.required) {
          for (const required of tool.inputSchema.required) {
            expect(tool.inputSchema.properties[required]).toBeDefined();
          }
        }
      }
    });

    test('Tool names follow Claude Desktop conventions', async () => {
      const tools = await server.listTools();
      
      for (const tool of tools) {
        // Snake_case naming
        expect(tool.name).toMatch(/^[a-z][a-z0-9_]*[a-z0-9]$/);
        
        // User-friendly descriptions
        expect(tool.description).not.toMatch(/\b(execute|process|handle)\b/i);
        expect(tool.description.length).toBeGreaterThan(10);
        expect(tool.description.length).toBeLessThan(200);
      }
    });
  });

  describe('MCP Request/Response Cycle', () => {
    test('Tool execution returns valid MCP responses', async () => {
      const result = await server.callTool('store_project_context', {
        project_name: 'test-mcp-project',
        description: 'Test project for MCP validation'
      });

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
    });

    test('Invalid tool parameters return proper MCP errors', async () => {
      const result = await server.callTool('store_project_context', {
        // Missing required project_name
        description: 'Invalid test'
      });

      expect(result).toHaveProperty('isError', true);
      expect(result).toHaveProperty('content');
      expect(result.content[0].text).toContain('project_name');
    });

    test('Tool execution includes proper error handling', async () => {
      const result = await server.callTool('git_operation', {
        action: 'status',
        repositoryPath: '/nonexistent/path'
      });

      // Should return structured error, not throw
      expect(result).toHaveProperty('content');
      if (result.isError) {
        expect(result.content[0].text).toContain('error');
      }
    });
  });

  describe('Context Persistence', () => {
    test('Context survives server restart simulation', async () => {
      // Store context
      await server.callTool('store_project_context', {
        project_name: 'persistence-test',
        description: 'Testing context persistence'
      });

      // Simulate restart by creating new server with same DB
      await server.close();
      
      const newServer = new MCPMProServer({
        mode: 'pro', 
        database: db
      });
      await newServer.initialize();

      // Verify context exists
      const result = await newServer.callTool('get_project_context', {
        project_name: 'persistence-test'
      });

      expect(result.content[0].text).toContain('persistence-test');
      
      await newServer.close();
    });
  });

  describe('Performance Requirements', () => {
    test('Tool calls complete within 100ms overhead target', async () => {
      const start = Date.now();
      
      await server.callTool('list_projects', {});
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // <100ms overhead target
    });

    test('Can handle concurrent tool calls', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => 
        server.callTool('store_context', {
          type: 'note',
          key: `concurrent-test-${i}`,
          value: `Test note ${i}`,
          project_name: 'concurrent-test'
        })
      );

      const results = await Promise.all(promises);
      
      expect(results.every(r => !r.isError)).toBe(true);
    });
  });
});

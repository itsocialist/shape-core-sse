/**
 * MCP Interface Tests for MPCM-Pro
 * Testing the actual tools exposed to Claude
 */

import { MCPMProServer } from '../../../src/index';
import { DatabaseManager } from '../../../src/db/database.js';
import { MockSuccessAdapter, MockErrorAdapter, MockConfigurableAdapter } from '../../../src/test-utils/mockAdapters';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('MPCM-Pro MCP Interface', () => {
  let server: MCPMProServer;
  let db: DatabaseManager;  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test database
    tempDir = mkdtempSync(join(tmpdir(), 'mpcm-pro-test-'));
    const dbPath = join(tempDir, 'test.db');
    
    // Initialize database and server
    db = await DatabaseManager.create(dbPath);
    server = new MCPMProServer(db);
    
    // Don't run the full server, just initialize services
    await server['initializeServices']();
  });

  afterEach(async () => {
    await server.close();
  });

  describe('tools/list - Tool Discovery', () => {
    it('should list all available tools including orchestration tools', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 1
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeInstanceOf(Array);
      
      const toolNames = response.result.tools.map((t: any) => t.name);
      
      // Should include orchestration tools
      expect(toolNames).toContain('execute_service');
      expect(toolNames).toContain('list_services');
      
      // Should include context memory tools
      expect(toolNames).toContain('store_project_context');
      expect(toolNames).toContain('store_context');
      expect(toolNames).toContain('search_context');
    });
  });
  describe('list_services - Service Discovery', () => {
    it('should list default filesystem service', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'list_services',
          arguments: {}
        },
        id: 2
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      
      const text = response.result.content[0].text;
      const serviceList = JSON.parse(text);
      
      expect(serviceList.totalServices).toBe(2); // filesystem + git
      expect(serviceList.services.find(s => s.name === 'filesystem')).toBeDefined();
      expect(serviceList.services.find(s => s.name === 'filesystem').status).toBe('active');
    });
  });

  describe('execute_service - Service Execution', () => {
    it('should handle service not found error', async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'execute_service',
          arguments: {
            service: 'non-existent-service',
            tool: 'some_command',
            args: {}
          }
        },
        id: 3
      };

      const response = await server.handleRequest(request);

      expect(response.error).toBeUndefined();
      expect(response.result).toBeDefined();
      
      const errorText = response.result.content[0].text;
      expect(errorText).toContain('❌ Error:');
      expect(errorText).toContain('not found');
    });
  });
});
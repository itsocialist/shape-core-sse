/**
 * Test for Story 2.1: Tool name audit for Claude Desktop optimization
 * Validates that all MCP tools follow Claude Desktop best practices
 */

import { MCPMProServer } from '../src/index.js';
import { DatabaseManager } from '../src/db/database.js';
import { TestDatabaseManager } from '../src/test-utils/test-database.js';

describe('Tool Name Audit Tests', () => {
  let server: MCPMProServer;
  let db: DatabaseManager;

  beforeEach(async () => {
    db = await TestDatabaseManager.createTestDatabase('tool-audit');
    // Create server instance for testing tool definitions
    server = new MCPMProServer();
  });

  afterEach(async () => {
    if (db) {
      await TestDatabaseManager.cleanupDatabase(db);
    }
  });

  test('should have tool names that follow Claude Desktop best practices', async () => {
    // Get all tool definitions from the server
    const tools = (server as any).getAllTools();
    
    // Each tool should follow naming conventions:
    // 1. Use snake_case or kebab-case (not camelCase)
    // 2. Be descriptive but concise
    // 3. Avoid redundant prefixes like "mcp_" or "shape_"
    // 4. Use action verbs where appropriate
    
    for (const tool of tools) {
      const toolName = tool.name;
      const toolDef = tool;
      // Test naming convention
      expect(toolName).toMatch(/^[a-z][a-z0-9_-]*$/);
      
      // Should not start with redundant prefixes
      expect(toolName).not.toMatch(/^(mcp|shape|context)_/);
      
      // Should be descriptive (min 3 characters)
      expect(toolName.length).toBeGreaterThanOrEqual(3);
      
      // Should not be unnecessarily long (max 30 characters)
      expect(toolName.length).toBeLessThanOrEqual(30);
      
      // Tool definition should have proper description
      expect(toolDef.description).toBeDefined();
      expect(toolDef.description.length).toBeGreaterThan(10);
      
      // Should have input schema
      expect(toolDef.inputSchema).toBeDefined();
    }
  });

  test('should have clear and user-friendly tool descriptions', async () => {
    const tools = (server as any).getAllTools();
    
    for (const tool of tools) {
      const toolName = tool.name;
      const toolDef = tool;
      const description = toolDef.description;
      
      // Description should be clear and start with action verb
      expect(description).toMatch(/^[A-Z]/); // Start with capital letter
      expect(description.length).toBeLessThanOrEqual(100); // Concise
      
      // Should not contain implementation details
      expect(description.toLowerCase()).not.toContain('database');
      expect(description.toLowerCase()).not.toContain('sqlite');
      expect(description.toLowerCase()).not.toContain('table');
      
      // Should focus on user benefit, not technical implementation
      // Allow "dry run" as it's user-facing terminology
      expect(description).not.toMatch(/\b(execute|process|handle)\b/i);
      expect(description).not.toMatch(/\brun\s+(command|function|operation)\b/i);
    }
  });

  test('should group related tools with consistent naming patterns', async () => {
    const tools = (server as any).getAllTools();
    const toolNames = tools.map((t: any) => t.name);
    
    // Context-related tools should have consistent naming
    const contextTools = toolNames.filter(name => 
      name.includes('context') || name.includes('store') || name.includes('search')
    );
    
    if (contextTools.length > 0) {
      // Should use consistent verb patterns
      const storeTools = contextTools.filter(name => name.includes('store'));
      const searchTools = contextTools.filter(name => name.includes('search'));
      
      // If we have store tools, they should be consistently named
      if (storeTools.length > 1) {
        // Check for consistent pattern like store_context, store_project_context
        expect(storeTools.every(name => name.startsWith('store_'))).toBeTruthy();
      }
      
      // If we have search tools, they should be consistently named  
      if (searchTools.length > 1) {
        // Check for consistent pattern like search_context, search_context
        expect(searchTools.every(name => name.startsWith('search_'))).toBeTruthy();
      }
    }
  });

  test('should have optimal tool parameter names', async () => {
    const tools = (server as any).getAllTools();
    
    for (const tool of tools) {
      const toolName = tool.name;
      const toolDef = tool;
      const properties = toolDef.inputSchema?.properties || {};
      
      for (const [paramName, paramDef] of Object.entries(properties)) {
        // Parameter names should be clear and descriptive
        expect(paramName.length).toBeGreaterThanOrEqual(2);
        expect(paramName).toMatch(/^[a-z][a-zA-Z0-9_]*$/); // camelCase or snake_case
        
        // Should not use abbreviations unless they're very common
        expect(paramName).not.toMatch(/\b(ctx|proj|sys|cfg|mgr)\b/);
        
        // Should have descriptions for complex parameters
        if (typeof paramDef === 'object' && paramDef.description) {
          expect(paramDef.description.length).toBeGreaterThan(5);
        }
      }
    }
  });
});

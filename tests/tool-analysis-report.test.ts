/**
 * Simple script to list all current tool names and descriptions
 * Helps with manual analysis for Story 2.1
 */

import { MCPMProServer } from '../src/index.js';
import { DatabaseManager } from '../src/db/database.js';
import { TestDatabaseManager } from '../src/test-utils/test-database.js';

describe('Tool Analysis Report', () => {
  test('should generate tool analysis report for Story 2.1', async () => {
    const db = await TestDatabaseManager.createTestDatabase('tool-analysis');
    const server = new MCPMProServer(db);
    
    try {
      const tools = (server as any).getAllTools();
      
      console.log('\n=== TOOL ANALYSIS REPORT FOR STORY 2.1 ===\n');
      console.log(`Total tools: ${tools.length}\n`);
      
      tools.forEach((tool: any, index: number) => {
        console.log(`${index + 1}. ${tool.name}`);
        console.log(`   Description: ${tool.description}`);
        console.log(`   Length: ${tool.description.length} chars`);
        
        if (tool.inputSchema?.properties) {
          const paramCount = Object.keys(tool.inputSchema.properties).length;
          console.log(`   Parameters: ${paramCount}`);
        }
        console.log('');
      });
      
      // Analyze patterns
      const toolNames = tools.map((t: any) => t.name);
      
      console.log('=== PATTERN ANALYSIS ===\n');
      console.log('Tools with underscore patterns:');
      toolNames.filter(name => name.includes('_')).forEach(name => console.log(`  - ${name}`));
      
      console.log('\nTools with camelCase:');
      toolNames.filter(name => /[A-Z]/.test(name)).forEach(name => console.log(`  - ${name}`));
      
      console.log('\nLong descriptions (>100 chars):');
      tools.filter((t: any) => t.description.length > 100).forEach((t: any) => {
        console.log(`  - ${t.name}: ${t.description.length} chars`);
      });
      
      console.log('\nTools mentioning implementation details:');
      tools.filter((t: any) => {
        const desc = t.description.toLowerCase();
        return desc.includes('database') || desc.includes('sqlite') || desc.includes('table');
      }).forEach((t: any) => {
        console.log(`  - ${t.name}: ${t.description}`);
      });
      
    } finally {
      await TestDatabaseManager.cleanupDatabase(db);
    }
    
    // This test always passes - it's just for analysis
    expect(true).toBe(true);
  });
});

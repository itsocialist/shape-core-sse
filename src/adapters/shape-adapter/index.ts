/**
 * Shape Core MCP Adapter
 * Lightweight adapter that forwards requests to the Shape Service
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { UnixSocketClient } from './client.js';
import { LRUCache } from './cache.js';
import { ServiceRequest, ServiceResponse, ContextEntry, Project } from './types.js';

// Configuration
const SOCKET_PATH = process.env.SHAPE_SOCKET_PATH || '/tmp/shape.sock';
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export class ShapeAdapter {
  private server: Server;
  private client: UnixSocketClient;
  private cache: LRUCache<string, any>;

  constructor() {
    this.server = new Server(
      {
        name: 'shape-core-adapter',
        version: '0.4.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.client = new UnixSocketClient(SOCKET_PATH);
    this.cache = new LRUCache({
      maxSize: CACHE_MAX_SIZE,
      ttl: CACHE_TTL,
    });

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'store_context',
          description: 'Store a context entry for a project',
          inputSchema: {
            type: 'object',
            properties: {
              project_name: { type: 'string' },
              key: { type: 'string' },
              type: { 
                type: 'string',
                enum: ['decision', 'code', 'standard', 'status', 'todo', 'note', 'config', 'issue', 'reference']
              },
              value: { type: 'string' },
              tags: { 
                type: 'array',
                items: { type: 'string' }
              },
              metadata: { type: 'object' },
              is_system_specific: { type: 'boolean' },
            },
            required: ['project_name', 'key', 'type', 'value'],
          },
        },
        {
          name: 'search_context',
          description: 'Search for context entries',
          inputSchema: {
            type: 'object',
            properties: {
              project_name: { type: 'string' },
              query: { type: 'string' },
              type: { type: 'string' },
              tags: { 
                type: 'array',
                items: { type: 'string' }
              },
              limit: { type: 'number' },
              since: { type: 'string' },
            },
          },
        },
        {
          name: 'get_project_context',
          description: 'Get all context for a project',
          inputSchema: {
            type: 'object',
            properties: {
              project_name: { type: 'string' },
              system_specific: { type: 'boolean' },
            },
            required: ['project_name'],
          },
        },
        {
          name: 'list_projects',
          description: 'List all projects',
          inputSchema: {
            type: 'object',
            properties: {
              include_archived: { type: 'boolean' },
            },
          },
        },
        {
          name: 'update_project_status',
          description: 'Update project status',
          inputSchema: {
            type: 'object',
            properties: {
              project_name: { type: 'string' },
              status: { 
                type: 'string',
                enum: ['active', 'paused', 'completed', 'archived']
              },
              note: { type: 'string' },
            },
            required: ['project_name', 'status'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Check cache first for read operations
        if (this.isReadOperation(name)) {
          const cacheKey = this.getCacheKey(name, args);
          const cached = this.cache.get(cacheKey);
          if (cached) {
            return { content: [{ type: 'text', text: cached }] };
          }
        }

        // Forward to Rust service
        const serviceRequest: ServiceRequest = {
          id: `${name}-${Date.now()}`,
          method: name,
          params: args,
        };

        const response = await this.client.sendRequest(serviceRequest);

        if (response.error) {
          throw new McpError(
            response.error.code,
            response.error.message
          );
        }

        // Format and cache response
        const formattedResult = this.formatResponse(name, response.result);
        
        if (this.isReadOperation(name)) {
          const cacheKey = this.getCacheKey(name, args);
          this.cache.set(cacheKey, formattedResult);
        }

        return {
          content: [{ type: 'text', text: formattedResult }],
        };
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to execute ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private isReadOperation(method: string): boolean {
    return ['search_context', 'get_project_context', 'list_projects'].includes(method);
  }

  private getCacheKey(method: string, args: any): string {
    return `${method}:${JSON.stringify(args)}`;
  }

  private formatResponse(method: string, result: any): string {
    switch (method) {
      case 'store_context':
        return `✅ Stored context: "${result.key || 'unknown'}"`;
      
      case 'search_context':
        return this.formatSearchResults(result);
      
      case 'get_project_context':
        return this.formatProjectContext(result);
      
      case 'list_projects':
        return this.formatProjectList(result);
      
      case 'update_project_status':
        return `✅ Updated project status to: ${result.status}`;
      
      default:
        return JSON.stringify(result, null, 2);
    }
  }

  private formatSearchResults(entries: ContextEntry[]): string {
    if (!entries || entries.length === 0) {
      return '🔍 No matching context entries found.';
    }

    const lines = [`🔍 Found ${entries.length} context entries:\n`];
    
    for (const entry of entries) {
      lines.push(`  • ${entry.type}: ${entry.key} [${entry.tags.join(', ')}]`);
      lines.push(`    → ${entry.value.substring(0, 100)}...`);
      lines.push(`    📅 ${new Date(entry.updated_at).toLocaleString()}`);
    }

    return lines.join('\n');
  }

  private formatProjectContext(data: any): string {
    const { project, entries } = data;
    const lines = [`📁 Project: ${project.name}`];
    
    if (project.description) {
      lines.push(`📝 Description: ${project.description}`);
    }
    
    lines.push(`📊 Status: ${project.status}`);
    lines.push(`📅 Last updated: ${new Date(project.updated_at).toLocaleString()}`);
    lines.push('');
    lines.push(`📚 Context Entries (${entries.length}):`);
    
    // Group by type
    const byType: Record<string, ContextEntry[]> = {};
    for (const entry of entries) {
      if (!byType[entry.type]) {
        byType[entry.type] = [];
      }
      byType[entry.type].push(entry);
    }

    for (const [type, typeEntries] of Object.entries(byType)) {
      lines.push(`\n📊 ${type.toUpperCase()} (${typeEntries.length}):`);
      for (const entry of typeEntries.slice(0, 5)) {
        lines.push(`  • ${entry.key} [${entry.tags.join(', ')}]`);
        lines.push(`    → ${entry.value.substring(0, 80)}...`);
      }
      if (typeEntries.length > 5) {
        lines.push(`  ... and ${typeEntries.length - 5} more`);
      }
    }

    return lines.join('\n');
  }

  private formatProjectList(projects: Project[]): string {
    if (!projects || projects.length === 0) {
      return '📋 No projects found.';
    }

    const lines = [`📋 Projects (${projects.length}):\n`];
    
    for (const project of projects) {
      lines.push(`📁 ${project.name} [${project.status}]`);
      if (project.description) {
        lines.push(`   ${project.description}`);
      }
      lines.push(`   📅 Updated: ${new Date(project.updated_at).toLocaleString()}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  async start(): Promise<void> {
    // Connect to Rust service
    await this.client.connect();
    
    // Start MCP server
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error('Shape Core Adapter started successfully');
    console.error(`Connected to Rust service at: ${SOCKET_PATH}`);
    console.error(`Cache: ${CACHE_MAX_SIZE} entries, ${CACHE_TTL}ms TTL`);
  }

  async stop(): Promise<void> {
    await this.client.disconnect();
    await this.server.close();
  }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const adapter = new ShapeAdapter();
  
  adapter.start().catch((error) => {
    console.error('Failed to start Shape Core Adapter:', error);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.error('\nShutting down Shape Core Adapter...');
    await adapter.stop();
    process.exit(0);
  });
}

/**
 * MPCM-Pro Adapter - Lightweight MCP server connecting to MPCM Service
 * 
 * This adapter implements the MCP protocol and forwards requests to
 * the Rust-based MPCM Service via Unix domain sockets.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { LRUCache } from 'lru-cache';
import net from 'net';
import { promisify } from 'util';

// Cache configuration
const CACHE_OPTIONS = {
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
  updateAgeOnGet: true,
  updateAgeOnHas: true,
};

// Service communication protocol
interface ServiceRequest {
  id: string;
  method: string;
  params: any;
}

interface ServiceResponse {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

class MpcmServiceClient {
  private socketPath: string;
  private socket?: net.Socket;
  private connected = false;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }>();

  constructor(socketPath: string = '/tmp/mpcm.sock') {
    this.socketPath = socketPath;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.socketPath);
      
      this.socket.on('connect', () => {
        this.connected = true;
        resolve();
      });

      this.socket.on('error', (err) => {
        this.connected = false;
        reject(new Error(`Failed to connect to MPCM service: ${err.message}`));
      });

      this.socket.on('data', (data) => {
        this.handleResponse(data);
      });

      this.socket.on('close', () => {
        this.connected = false;
        this.reconnect();
      });
    });
  }

  private async reconnect(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 1000));
    try {
      await this.connect();
    } catch (err) {
      console.error('Reconnection failed:', err);
      setTimeout(() => this.reconnect(), 5000);
    }
  }

  private handleResponse(data: Buffer): void {
    try {
      const response: ServiceResponse = JSON.parse(data.toString());
      const pending = this.pendingRequests.get(response.id);
      
      if (pending) {
        this.pendingRequests.delete(response.id);
        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      }
    } catch (err) {
      console.error('Failed to parse response:', err);
    }
  }

  async request(method: string, params: any): Promise<any> {
    if (!this.connected) {
      await this.connect();
    }

    const id = Math.random().toString(36).substring(7);
    const request: ServiceRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      this.socket!.write(JSON.stringify(request) + '\n');
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }
}

class MpcmProAdapter {
  private server: Server;
  private cache: LRUCache<string, any>;
  private serviceClient: MpcmServiceClient;

  constructor() {
    this.server = new Server(
      {
        name: 'mpcm-pro',
        version: '0.3.1',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.cache = new LRUCache(CACHE_OPTIONS);
    this.serviceClient = new MpcmServiceClient();
    
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'store_context',
          description: 'Store context information for a project',
          inputSchema: {
            type: 'object',
            properties: {
              project_name: { type: 'string' },
              key: { type: 'string' },
              type: { type: 'string' },
              value: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
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
              limit: { type: 'number' },
            },
            required: ['project_name'],
          },
        },
        {
          name: 'get_project_context',
          description: 'Get all context for a project',
          inputSchema: {
            type: 'object',
            properties: {
              project_name: { type: 'string' },
            },
            required: ['project_name'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'store_context':
            return await this.storeContext(args);
          
          case 'search_context':
            return await this.searchContext(args);
          
          case 'get_project_context':
            return await this.getProjectContext(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error.message}`,
          }],
          isError: true,
        };
      }
    });
  }

  private async storeContext(args: any): Promise<any> {
    // No caching for writes
    const result = await this.serviceClient.request('store_context', args);
    
    // Invalidate related cache entries
    this.invalidateCache(args.project_name);
    
    return {
      content: [{
        type: 'text',
        text: `✅ Stored context: "${args.key}"`,
      }],
    };
  }

  private async searchContext(args: any): Promise<any> {
    // Check cache first
    const cacheKey = this.getCacheKey('search', args);
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return {
        content: [{
          type: 'text',
          text: cached,
        }],
      };
    }

    // Forward to service
    const result = await this.serviceClient.request('search_context', args);
    
    // Format as XML for Claude optimization
    const xml = this.formatSearchResultsAsXml(result);
    
    // Cache the result
    this.cache.set(cacheKey, xml);
    
    return {
      content: [{
        type: 'text',
        text: xml,
      }],
    };
  }

  private async getProjectContext(args: any): Promise<any> {
    const cacheKey = this.getCacheKey('project', args);
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return {
        content: [{
          type: 'text',
          text: cached,
        }],
      };
    }

    const result = await this.serviceClient.request('get_project_context', args);
    const xml = this.formatProjectContextAsXml(result);
    
    this.cache.set(cacheKey, xml);
    
    return {
      content: [{
        type: 'text',
        text: xml,
      }],
    };
  }

  private getCacheKey(operation: string, params: any): string {
    return `${operation}:${JSON.stringify(params)}`;
  }

  private invalidateCache(projectName: string): void {
    // Remove all cache entries for this project
    for (const key of this.cache.keys()) {
      if (key.includes(projectName)) {
        this.cache.delete(key);
      }
    }
  }

  private formatSearchResultsAsXml(results: any[]): string {
    // Format results as XML for optimal Claude processing
    let xml = '<search-results>\n';
    
    for (const result of results) {
      xml += `  <context key="${result.key}" type="${result.type}">\n`;
      xml += `    <project>${result.project_name}</project>\n`;
      xml += `    <value>${this.escapeXml(result.value)}</value>\n`;
      xml += `    <created>${result.created_at}</created>\n`;
      xml += `  </context>\n`;
    }
    
    xml += '</search-results>';
    return xml;
  }

  private formatProjectContextAsXml(contexts: any[]): string {
    // Hierarchical XML format for project context
    const byType = this.groupByType(contexts);
    
    let xml = '<project-context>\n';
    
    for (const [type, items] of Object.entries(byType)) {
      xml += `  <${type}>\n`;
      for (const item of items as any[]) {
        xml += `    <entry key="${item.key}">\n`;
        xml += `      <value>${this.escapeXml(item.value)}</value>\n`;
        xml += `    </entry>\n`;
      }
      xml += `  </${type}>\n`;
    }
    
    xml += '</project-context>';
    return xml;
  }

  private groupByType(contexts: any[]): Record<string, any[]> {
    return contexts.reduce((acc, ctx) => {
      if (!acc[ctx.type]) acc[ctx.type] = [];
      acc[ctx.type].push(ctx);
      return acc;
    }, {});
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('MPCM-Pro Adapter started');
  }
}

// Start the adapter
const adapter = new MpcmProAdapter();
adapter.run().catch(console.error);

// Export the adapter class
export { MpcmProAdapter as MPCMAdapter };
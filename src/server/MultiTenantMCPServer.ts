/**
 * Multi-Tenant MCP Server
 * Main orchestrator for SSE-enabled Ship APE Core
 */

import { HttpServerTransport, HttpTransportConfig, MCPRequest, MCPResponse } from '../transport/HttpServerTransport.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { MCPMProServer } from '../index.js';
import { TenantManager } from './TenantManager.js';
import { DatabaseManager } from '../db/database.js';

export interface ServerConfig {
  mode: 'stdio' | 'sse' | 'dual';
  httpConfig?: HttpTransportConfig;
  enableStdio?: boolean;
  dbPath?: string;
  tenantDataPath?: string;
}

export class MultiTenantMCPServer {
  private httpTransport?: HttpServerTransport;
  private stdioServer?: MCPMProServer;
  private tenantManager: TenantManager;
  private config: ServerConfig;

  constructor(config: ServerConfig) {
    this.config = config;
    this.tenantManager = new TenantManager({
      dataPath: config.tenantDataPath || './tenant-data',
      masterKey: config.httpConfig?.masterKey || 'dev-master-key'
    });

    this.setupTransports();
  }

  private setupTransports(): void {
    // Setup HTTP/SSE transport if enabled
    if (this.config.mode === 'sse' || this.config.mode === 'dual') {
      if (!this.config.httpConfig) {
        throw new Error('HTTP config required for SSE mode');
      }

      this.httpTransport = new HttpServerTransport(this.config.httpConfig);
      this.httpTransport.setRequestHandler(this.handleMCPRequest.bind(this));
      this.httpTransport.setTenantCreationHandler(this.tenantManager.createTenant.bind(this.tenantManager));
      this.httpTransport.setTenantDeletionHandler(this.tenantManager.deleteTenant.bind(this.tenantManager));
      this.httpTransport.setTenantListHandler(this.tenantManager.listTenants.bind(this.tenantManager));
      this.httpTransport.setAuthenticationHandler(this.tenantManager.authenticate.bind(this.tenantManager));
    }

    // Setup stdio transport if enabled (default for dual mode)
    if (this.config.mode === 'stdio' || this.config.mode === 'dual') {
      // Stdio server will be created on demand
    }
  }

  private async handleMCPRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      // Extract tenant ID from request context (set by auth middleware)
      const tenantId = this.extractTenantFromRequest(request);
      if (!tenantId) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32001,
            message: 'Tenant identification required'
          }
        };
      }

      // Get or create tenant-specific server instance
      const tenantServer = await this.tenantManager.getTenantServer(tenantId);
      if (!tenantServer) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32002,
            message: 'Tenant server unavailable'
          }
        };
      }

      // Forward request to tenant server
      const response = await tenantServer.handleRequest({
        jsonrpc: '2.0',
        id: request.id,
        method: request.method,
        params: request.params
      });

      return response;

    } catch (error) {
      console.error('[MultiTenant] Request handling error:', error);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: { reason: error instanceof Error ? error.message : 'Unknown error' }
        }
      };
    }
  }

  private extractTenantFromRequest(request: MCPRequest): string | null {
    // Use tenant ID from HTTP transport authentication
    if (request.tenantId) {
      return request.tenantId;
    }
    
    // Fallback for development mode
    if (process.env.NODE_ENV === 'development') {
      return 'dev-tenant-001';
    }
    
    // In production, this would be extracted from the authenticated context
    return null;
  }

  public async start(): Promise<void> {
    console.log('[MultiTenant] Starting Ship APE Core SSE v0.4.0...');

    // Initialize tenant manager
    await this.tenantManager.initialize();

    // Start HTTP/SSE server
    if (this.httpTransport) {
      await this.httpTransport.start();
      console.log(`[MultiTenant] HTTP/SSE transport started on port ${this.config.httpConfig?.port}`);
    }

    // Start stdio server for backward compatibility
    if (this.config.mode === 'stdio' || this.config.mode === 'dual') {
      await this.startStdioServer();
    }

    console.log('[MultiTenant] Server startup complete');
    console.log(`[MultiTenant] Mode: ${this.config.mode}`);
    console.log(`[MultiTenant] Active transports: ${this.getActiveTransports().join(', ')}`);
  }

  private async startStdioServer(): Promise<void> {
    try {
      // Create database for stdio mode
      const dbPath = this.config.dbPath || process.env.SHAPE_PRO_DB_PATH || '~/.shape-core/shape-core.db';
      const db = await DatabaseManager.create(dbPath);
      
      this.stdioServer = new MCPMProServer(db, true);
      
      // Only connect stdio transport if we're not in SSE-only mode
      if (this.config.mode === 'stdio') {
        await this.stdioServer.run();
      } else {
        // Just initialize for dual mode
        await this.stdioServer.initialize();
      }
      
      console.log('[MultiTenant] Stdio transport ready');
    } catch (error) {
      console.error('[MultiTenant] Failed to start stdio server:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    console.log('[MultiTenant] Shutting down server...');

    // Stop HTTP transport
    if (this.httpTransport) {
      await this.httpTransport.stop();
      console.log('[MultiTenant] HTTP/SSE transport stopped');
    }

    // Stop tenant manager (closes all tenant databases)
    await this.tenantManager.shutdown();
    console.log('[MultiTenant] Tenant manager stopped');

    // Close stdio server
    if (this.stdioServer) {
      await this.stdioServer.close();
      console.log('[MultiTenant] Stdio server stopped');
    }

    console.log('[MultiTenant] Server shutdown complete');
  }

  public getStats(): {
    mode: string;
    activeTransports: string[];
    activeTenants: number;
    sseConnections: number;
    uptime: number;
  } {
    return {
      mode: this.config.mode,
      activeTransports: this.getActiveTransports(),
      activeTenants: this.tenantManager.getActiveTenantCount(),
      sseConnections: this.httpTransport?.getActiveConnections() || 0,
      uptime: process.uptime()
    };
  }

  public async createTenant(options: {
    tenantId?: string;
    permissions?: string[];
  } = {}): Promise<{
    tenantId: string;
    apiKey: string;
  }> {
    return await this.tenantManager.createTenant(options);
  }

  public async deleteTenant(tenantId: string): Promise<void> {
    await this.tenantManager.deleteTenant(tenantId);
  }

  public listTenants(): any[] {
    return this.tenantManager.listTenants();
  }

  private getActiveTransports(): string[] {
    const transports: string[] = [];
    
    if (this.httpTransport) {
      transports.push('http/sse');
    }
    
    if (this.stdioServer || this.config.mode === 'stdio') {
      transports.push('stdio');
    }
    
    return transports;
  }

  // Method to broadcast events to all SSE connections for a tenant
  public broadcastToTenant(tenantId: string, event: any): void {
    if (this.httpTransport) {
      this.httpTransport.broadcastToTenant(tenantId, event);
    }
  }

  // Method to get tenant-specific connection count
  public getTenantConnectionCount(tenantId: string): number {
    if (this.httpTransport) {
      return this.httpTransport.getTenantConnections(tenantId);
    }
    return 0;
  }
}
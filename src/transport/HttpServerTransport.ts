/**
 * HTTP/SSE Transport for Ship APE Core SSE
 * Provides HTTP + Server-Sent Events transport for Claude Web/Mobile integration
 */

import express from 'express';
import { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server as HttpServer } from 'http';
import { SSEConnection } from './SSEConnection.js';
import { TenantAuthenticator } from '../security/TenantAuthenticator.js';

export interface HttpTransportConfig {
  port: number;
  corsOrigins: string[];
  masterKey: string;
}

export interface MCPRequest {
  method: string;
  params: any;
  id?: string | number;
  tenantId?: string;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPRequestHandler {
  (request: MCPRequest): Promise<MCPResponse>;
}

export interface TenantCreationHandler {
  (options: { tenantId?: string; permissions?: string[] }): Promise<{ tenantId: string; apiKey: string }>;
}

export interface TenantDeletionHandler {
  (tenantId: string): Promise<void>;
}

export interface TenantListHandler {
  (): any[];
}

export interface AuthenticationHandler {
  (apiKey: string): Promise<{ tenantId: string; permissions?: string[] }>;
}

export class HttpServerTransport {
  private app: express.Application;
  private server?: HttpServer;
  private sseConnections = new Map<string, SSEConnection>();
  private authenticator: TenantAuthenticator;
  private requestHandler?: MCPRequestHandler;
  private tenantCreationHandler?: TenantCreationHandler;
  private tenantDeletionHandler?: TenantDeletionHandler;
  private tenantListHandler?: TenantListHandler;
  private authenticationHandler?: AuthenticationHandler;

  constructor(private config: HttpTransportConfig) {
    this.app = express();
    this.authenticator = new TenantAuthenticator(config.masterKey);
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: this.config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[SSE] ${req.method} ${req.path} - ${new Date().toISOString()}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '0.4.0',
        transport: 'http/sse'
      });
    });

    // OAuth token endpoint for Claude Web
    this.app.post('/oauth/token', async (req: Request, res: Response) => {
      try {
        const { client_id, client_secret, grant_type } = req.body;
        
        if (grant_type !== 'client_credentials') {
          return res.status(400).json({
            error: 'unsupported_grant_type',
            error_description: 'Only client_credentials grant type is supported'
          });
        }

        // Validate client credentials against tenant database
        if (!client_id || !client_secret) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: 'client_id and client_secret are required'
          });
        }

        try {
          // Use client_secret as API key for authentication
          const authResult = await this.authenticateTenant({
            headers: { authorization: `Bearer ${client_secret}` }
          } as Request);
          
          if (!authResult.success) {
            return res.status(401).json({
              error: 'invalid_client',
              error_description: 'Invalid client credentials'
            });
          }

          // Return OAuth token response (using the same API key as access token)
          res.json({
            access_token: client_secret,
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'mcp'
          });

        } catch (error) {
          res.status(401).json({
            error: 'invalid_client',
            error_description: 'Authentication failed'
          });
        }
      } catch (error) {
        res.status(500).json({
          error: 'server_error',
          error_description: 'Internal server error'
        });
      }
    });

    // MCP tool execution endpoint
    this.app.post('/mcp', async (req: Request, res: Response) => {
      try {
        // Authenticate tenant
        const authResult = await this.authenticateTenant(req);
        if (!authResult.success) {
          return res.status(401).json({
            jsonrpc: '2.0',
            id: req.body.id,
            error: {
              code: -32001,
              message: 'Authentication failed',
              data: { reason: authResult.error }
            }
          });
        }

        // Validate MCP request format
        const mcpRequest = this.validateMCPRequest(req.body);
        if (!mcpRequest) {
          return res.status(400).json({
            jsonrpc: '2.0',
            id: req.body.id,
            error: {
              code: -32600,
              message: 'Invalid Request',
              data: { reason: 'Malformed MCP request' }
            }
          });
        }

        // Handle the MCP request
        if (!this.requestHandler) {
          return res.status(500).json({
            jsonrpc: '2.0',
            id: req.body.id,
            error: {
              code: -32603,
              message: 'Internal error',
              data: { reason: 'No request handler configured' }
            }
          });
        }

        // Add tenant context to the MCP request
        mcpRequest.tenantId = authResult.tenantId;
        
        console.log(`[SSE] MCP Request - Method: ${mcpRequest.method}, Tenant: ${mcpRequest.tenantId}, Params:`, mcpRequest.params);

        const response = await this.requestHandler(mcpRequest);
        
        // Add tenant context to response if needed
        if (authResult.tenantId) {
          // Could add tenant-specific metadata here
        }

        res.json(response);

      } catch (error) {
        console.error('[SSE] MCP request error:', error);
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body.id,
          error: {
            code: -32603,
            message: 'Internal error',
            data: { 
              reason: error instanceof Error ? error.message : 'Unknown error' 
            }
          }
        });
      }
    });

    // Server-Sent Events endpoint
    this.app.get('/mcp/sse/:sessionId', async (req: Request, res: Response) => {
      try {
        // Authenticate tenant
        const authResult = await this.authenticateTenant(req);
        if (!authResult.success) {
          return res.status(401).json({
            error: 'Authentication failed',
            reason: authResult.error
          });
        }

        const sessionId = req.params.sessionId;
        
        // Setup SSE headers
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': req.headers.origin || '*',
          'Access-Control-Allow-Credentials': 'true'
        });

        // Create SSE connection
        const sseConnection = new SSEConnection(sessionId, res, authResult.tenantId);
        this.sseConnections.set(sessionId, sseConnection);

        // Handle connection close
        req.on('close', () => {
          console.log(`[SSE] Session ${sessionId} disconnected`);
          sseConnection.close();
          this.sseConnections.delete(sessionId);
        });

        // Send initial connection event
        sseConnection.send({
          type: 'connected',
          data: {
            sessionId,
            timestamp: new Date().toISOString(),
            message: 'SSE connection established'
          }
        });

        console.log(`[SSE] Session ${sessionId} connected for tenant ${authResult.tenantId}`);

      } catch (error) {
        console.error('[SSE] SSE connection error:', error);
        res.status(500).json({
          error: 'SSE connection failed',
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Admin-only tenant registration endpoint
    this.app.post('/tenant/register', async (req: Request, res: Response) => {
      try {
        // Authenticate admin using master key
        const authResult = await this.authenticateAdmin(req);
        if (!authResult.success) {
          return res.status(401).json({
            error: 'Admin authentication required',
            message: 'Provide X-Master-Key header with valid master key'
          });
        }

        const { tenantId, permissions } = req.body;
        
        if (!this.tenantCreationHandler) {
          return res.status(500).json({
            error: 'Tenant creation not configured',
            message: 'Tenant creation handler not available'
          });
        }
        
        const result = await this.tenantCreationHandler({
          tenantId,
          permissions: permissions || ['read', 'write']
        });

        res.json({
          success: true,
          tenant: {
            tenantId: result.tenantId,
            apiKey: result.apiKey,
            permissions: permissions || ['read', 'write']
          },
          message: 'Tenant created successfully'
        });

      } catch (error) {
        console.error('[SSE] Tenant registration error:', error);
        res.status(400).json({
          error: 'Registration failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Tenant status endpoint
    this.app.get('/tenant/status', async (req: Request, res: Response) => {
      try {
        const authResult = await this.authenticateTenant(req);
        if (!authResult.success) {
          return res.status(401).json({
            error: 'Authentication failed',
            reason: authResult.error
          });
        }

        res.json({
          tenantId: authResult.tenantId,
          status: 'active',
          timestamp: new Date().toISOString(),
          sseConnections: Array.from(this.sseConnections.keys()).length
        });

      } catch (error) {
        res.status(500).json({
          error: 'Status check failed',
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Admin-only tenant management endpoints
    this.app.get('/admin/tenants', async (req: Request, res: Response) => {
      try {
        const authResult = await this.authenticateAdmin(req);
        if (!authResult.success) {
          return res.status(401).json({
            error: 'Admin authentication required'
          });
        }

        const tenants = this.tenantListHandler ? this.tenantListHandler() : this.authenticator.listTenants();
        res.json({
          success: true,
          tenants,
          totalCount: tenants.length,
          activeCount: this.authenticator.getActiveTenantCount()
        });

      } catch (error) {
        console.error('[SSE] Admin tenant list error:', error);
        res.status(500).json({
          error: 'Failed to list tenants',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    this.app.post('/admin/tenant/:tenantId/rotate-key', async (req: Request, res: Response) => {
      try {
        const authResult = await this.authenticateAdmin(req);
        if (!authResult.success) {
          return res.status(401).json({
            error: 'Admin authentication required'
          });
        }

        const { tenantId } = req.params;
        const newApiKey = await this.authenticator.rotateApiKey(tenantId);
        
        res.json({
          success: true,
          tenantId,
          newApiKey,
          message: 'API key rotated successfully'
        });

      } catch (error) {
        console.error('[SSE] API key rotation error:', error);
        res.status(400).json({
          error: 'Key rotation failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    this.app.delete('/admin/tenant/:tenantId', async (req: Request, res: Response) => {
      try {
        const authResult = await this.authenticateAdmin(req);
        if (!authResult.success) {
          return res.status(401).json({
            error: 'Admin authentication required'
          });
        }

        const { tenantId } = req.params;
        
        if (this.tenantDeletionHandler) {
          await this.tenantDeletionHandler(tenantId);
        } else {
          await this.authenticator.deleteTenant(tenantId);
        }
        
        res.json({
          success: true,
          tenantId,
          message: 'Tenant deleted successfully'
        });

      } catch (error) {
        console.error('[SSE] Tenant deletion error:', error);
        res.status(400).json({
          error: 'Deletion failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 404 handler
    this.app.use((req: Request, res: Response) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Endpoint ${req.method} ${req.path} not found`,
        availableEndpoints: [
          'GET /health',
          'POST /mcp',
          'GET /mcp/sse/:sessionId',
          'POST /tenant/register (admin)',
          'GET /tenant/status',
          'GET /admin/tenants (admin)',
          'POST /admin/tenant/:tenantId/rotate-key (admin)', 
          'DELETE /admin/tenant/:tenantId (admin)'
        ]
      });
    });
  }

  private async authenticateTenant(req: Request): Promise<{
    success: boolean;
    tenantId?: string;
    error?: string;
  }> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { success: false, error: 'Missing or invalid Authorization header' };
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix
    
    try {
      // Use custom authentication handler if available, otherwise fallback to local authenticator
      if (this.authenticationHandler) {
        const result = await this.authenticationHandler(token);
        return {
          success: true,
          tenantId: result.tenantId
        };
      } else {
        const result = await this.authenticator.authenticate(token);
        return {
          success: true,
          tenantId: result.tenantId
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
    }
  }

  private async authenticateAdmin(req: Request): Promise<{ success: boolean; error?: string }> {
    try {
      const masterKey = req.headers['x-master-key'] as string;
      
      if (!masterKey) {
        return {
          success: false,
          error: 'Missing X-Master-Key header'
        };
      }

      if (masterKey !== this.config.masterKey) {
        return {
          success: false,
          error: 'Invalid master key'
        };
      }

      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Admin authentication failed'
      };
    }
  }

  private validateMCPRequest(body: any): MCPRequest | null {
    if (!body || typeof body !== 'object') {
      return null;
    }

    // Basic MCP request validation
    if (!body.method || typeof body.method !== 'string') {
      return null;
    }

    return {
      method: body.method,
      params: body.params || {},
      id: body.id
    };
  }

  public setRequestHandler(handler: MCPRequestHandler): void {
    this.requestHandler = handler;
  }

  public setTenantCreationHandler(handler: TenantCreationHandler): void {
    this.tenantCreationHandler = handler;
  }

  public setTenantDeletionHandler(handler: TenantDeletionHandler): void {
    this.tenantDeletionHandler = handler;
  }

  public setTenantListHandler(handler: TenantListHandler): void {
    this.tenantListHandler = handler;
  }

  public setAuthenticationHandler(handler: AuthenticationHandler): void {
    this.authenticationHandler = handler;
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Bind to 0.0.0.0 for Railway compatibility
        this.server = this.app.listen(this.config.port, '0.0.0.0', () => {
          console.log(`[SSE] HTTP/SSE server listening on 0.0.0.0:${this.config.port}`);
          console.log(`[SSE] Health check: http://localhost:${this.config.port}/health`);
          console.log(`[SSE] MCP endpoint: http://localhost:${this.config.port}/mcp`);
          resolve();
        });

        this.server.on('error', (error) => {
          console.error('[SSE] Server error:', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all SSE connections
      for (const connection of Array.from(this.sseConnections.values())) {
        connection.close();
      }
      this.sseConnections.clear();

      if (this.server) {
        this.server.close(() => {
          console.log('[SSE] HTTP/SSE server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public broadcastToTenant(tenantId: string, event: any): void {
    for (const connection of Array.from(this.sseConnections.values())) {
      if (connection.getTenantId() === tenantId) {
        connection.send(event);
      }
    }
  }

  public getActiveConnections(): number {
    return this.sseConnections.size;
  }

  public getTenantConnections(tenantId: string): number {
    let count = 0;
    for (const connection of Array.from(this.sseConnections.values())) {
      if (connection.getTenantId() === tenantId) {
        count++;
      }
    }
    return count;
  }
}
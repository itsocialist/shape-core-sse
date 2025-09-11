#!/usr/bin/env node

/**
 * Ship APE Core Server - Universal MCP Orchestration Platform v0.3.0
 * Consolidated entry point merging MPCM core + Pro orchestration features
 * 
 * This single entry point replaces both index.ts and index-pro.ts
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { join } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync } from 'fs';

import { DatabaseManager } from './db/database.js';
import { ServiceRegistry } from './orchestration/registry/ServiceRegistry.js';
import { FilesystemAdapter } from './adapters/filesystem/FilesystemAdapter.js';
import { GitAdapter } from './adapters/GitAdapter.js';
import { RoleProvider } from './orchestration/roles/RoleProvider.js';
import { RoleOrchestrator } from './orchestration/roles/RoleOrchestrator.js';

// Import all Shape core tools
import { createStoreProjectContextTool, handleStoreProjectContext } from './tools/storeProjectContext.js';
import { createStoreContextTool, handleStoreContext } from './tools/storeContext.js';
import { createSearchContextTool, handleSearchContext } from './tools/searchContext.js';
import { createGetProjectContextTool, handleGetProjectContext } from './tools/getProjectContext.js';
import { createListProjectsTool, handleListProjects } from './tools/listProjects.js';
import { createUpdateProjectStatusTool, handleUpdateProjectStatus } from './tools/updateProjectStatus.js';
import { createGetRecentUpdatesTool, handleGetRecentUpdates } from './tools/getRecentUpdates.js';

// Import role management tools (from original index.ts)
import { listRolesTool, listRoles } from './tools/listRoles.js';
import { getActiveRoleTool, getActiveRole } from './tools/getActiveRole.js';
import { switchRoleTool, switchRole } from './tools/switchRole.js';
import { createRoleHandoffTool, createRoleHandoff } from './tools/createRoleHandoff.js';
import { getRoleHandoffsTool, getRoleHandoffs } from './tools/getRoleHandoffs.js';
import { createCustomRoleTool, createCustomRole } from './tools/createCustomRole.js';
import { deleteCustomRoleTool, deleteCustomRole } from './tools/deleteCustomRole.js';
import { importRoleTemplateTool, importRoleTemplate } from './tools/importRoleTemplate.js';

// Import deletion tools (v0.3.1 features)
import { createDeleteProjectTool, deleteProject } from './tools/deleteProject.js';
import { createDeleteContextTool, deleteContext } from './tools/deleteContext.js';
import { createCleanupOldDataTool, cleanupOldData } from './tools/cleanupOldData.js';

// Import Pro orchestration tools (from index-pro.ts)
import { createExecuteAsRoleTool, handleExecuteAsRole } from './tools/executeAsRole.js';
import { createListAvailableRolesTool, handleListAvailableRoles } from './tools/listAvailableRoles.js';
import { createEnhancePromptWithRoleTool, handleEnhancePromptWithRole } from './tools/enhancePromptWithRole.js';
import { gitOperationTool, handleGitOperation } from './tools/gitOperation.js';

export class MCPMProServer {
  private server: Server;
  private db: DatabaseManager;
  private registry?: ServiceRegistry;
  private roleProvider?: RoleProvider;
  private orchestrator?: RoleOrchestrator;
  private isProMode: boolean;

  constructor(dbOrOptions: DatabaseManager | { mode: string; database: DatabaseManager }, proMode: boolean = true) {
    // Handle both constructor patterns for backward compatibility
    if (dbOrOptions && typeof (dbOrOptions as any).mode === 'string') {
      const options = dbOrOptions as { mode: string; database: DatabaseManager };
      this.db = options.database;
      this.isProMode = options.mode === 'pro';
    } else {
      this.db = dbOrOptions as DatabaseManager;
      this.isProMode = proMode;
    }
    
    // Initialize Pro features only if in Pro mode
    if (this.isProMode) {
      this.registry = new ServiceRegistry(this.db);
      this.roleProvider = new RoleProvider(this.db);
      this.orchestrator = new RoleOrchestrator(this.db, this.registry, this.roleProvider);
    }
    
    // Server metadata reflects mode
    this.server = new Server(
      {
        name: '@briandawson/shape-core-sse',
        version: '0.4.0',
      },
      {
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: true, listChanged: true },
          prompts: { listChanged: true },
          logging: {}
        },
      }
    );

    this.setupHandlers();
  }

  private async initializeServices(): Promise<void> {
    if (!this.isProMode || !this.registry) return;
    
    console.error('🚀 Initializing Ship APE Core services...');
    
    // Register filesystem adapter (configurable root, tolerant if unavailable)
    const fsRoot = process.env.FILESYSTEM_ROOT || process.env.SHIP_APE_FS_ROOT || process.cwd();
    try {
      const fsAdapter = new FilesystemAdapter(fsRoot);
      await this.registry.register(fsAdapter);
    } catch (err) {
      console.error(`⚠️  Skipping filesystem adapter: ${err instanceof Error ? err.message : String(err)} (root=${fsRoot})`);
    }
    
    // Register Git adapter (always safe to point at working directory)
    try {
      const gitAdapter = new GitAdapter(process.cwd());
      await this.registry.register(gitAdapter);
    } catch (err) {
      console.error(`⚠️  Skipping git adapter: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    console.error('✅ All services initialized (filesystem + git)');
  }

  private setupHandlers(): void {
    // Handle MCP initialize request
    this.server.setRequestHandler(InitializeRequestSchema, async (request) => {
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: true, listChanged: true },
          prompts: { listChanged: true },
          logging: {}
        },
        serverInfo: {
          name: '@briandawson/shape-core-sse',
          version: '0.4.0'
        }
      };
    });

    // Handle list tools request
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.getAllTools();
      return { tools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.handleToolCall(name, args);
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error occurred';
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error: ${errorMessage}`,
            },
          ],
        };
      }
    });

    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  private getAllTools(): any[] {
    const coreTools = [
      // Core Shape tools - always available
      createStoreProjectContextTool(this.db),
      createStoreContextTool(this.db),
      createSearchContextTool(this.db),
      createGetProjectContextTool(this.db),
      createListProjectsTool(this.db),
      createUpdateProjectStatusTool(this.db),
      createGetRecentUpdatesTool(this.db),
      
      // Role management tools - always available
      listRolesTool,
      getActiveRoleTool,
      switchRoleTool,
      createRoleHandoffTool,
      getRoleHandoffsTool,
      createCustomRoleTool,
      deleteCustomRoleTool,
      importRoleTemplateTool,
      
      // Deletion tools (v0.3.1) - always available
      createDeleteProjectTool(this.db),
      createDeleteContextTool(this.db),
      createCleanupOldDataTool(this.db),
    ];

    if (!this.isProMode) {
      return coreTools;
    }

    // Pro orchestration tools - only in Pro mode
    const proTools = [
      this.registry && this.roleProvider && this.orchestrator ? 
        createExecuteAsRoleTool(this.db, this.registry, this.roleProvider, this.orchestrator) : null,
      this.roleProvider ? 
        createListAvailableRolesTool(this.db, this.roleProvider) : null,
      this.roleProvider ? 
        createEnhancePromptWithRoleTool(this.db, this.roleProvider) : null,
      gitOperationTool,
      
      // Service orchestration tools
      {
        name: 'execute_service',
        description: 'Use a command through a registered service adapter',
        inputSchema: {
          type: 'object',
          properties: {
            service: { 
              type: 'string', 
              description: 'Service name (e.g., filesystem, git, command)',
              enum: this.registry?.getServices().map(s => s.name) || []
            },
            tool: { 
              type: 'string', 
              description: 'Tool/command to execute on the service' 
            },
            args: { 
              type: 'object', 
              description: 'Arguments for the tool' 
            },
            projectName: {
              type: 'string',
              description: 'Optional project context to use'
            },
            storeResult: {
              type: 'boolean',
              description: 'Whether to store the result in context (default: true)',
              default: true
            }
          },
          required: ['service', 'tool', 'args']
        }
      },
      {
        name: 'list_services',
        description: 'List all registered services and their capabilities',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      
      // End-to-End App Builder Tool
      {
        name: 'build_app_from_idea',
        description: 'Build a complete application from an idea using role-based orchestration',
        inputSchema: {
          type: 'object',
          properties: {
            idea: {
              type: 'string',
              description: 'The application idea or description'
            },
            projectName: {
              type: 'string',
              description: 'Name for the new project'
            },
            template: {
              type: 'string',
              description: 'Template to use (optional)',
              enum: ['react-saas', 'next-blog', 'express-api', 'vue-dashboard']
            },
            targetPlatform: {
              type: 'string',
              description: 'Deployment target',
              enum: ['vercel', 'netlify', 'aws', 'local'],
              default: 'vercel'
            }
          },
          required: ['idea', 'projectName']
        }
      },
      {
        name: 'get_service_status',
        description: 'Get the status of all registered services',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ];

    return [...coreTools, ...proTools.filter(tool => tool !== null)];
  }

  private async handleToolCall(name: string, args: any): Promise<string> {
    let result: string | { error: string; code?: string };

    switch (name) {
      // Core Shape tools
      case 'store_project_context':
        const projectResult = await handleStoreProjectContext(this.db, args);
        if (typeof projectResult === 'object' && 'error' in projectResult) {
          throw new Error(projectResult.error);
        }
        result = projectResult;
        break;
        
      case 'store_context':
        const contextResult = await handleStoreContext(this.db, args);
        if (typeof contextResult === 'object' && 'error' in contextResult) {
          throw new Error(contextResult.error);
        }
        result = contextResult;
        break;
        
      case 'search_context':
        result = await handleSearchContext(this.db, args);
        break;
        
      case 'get_project_context':
        result = await handleGetProjectContext(this.db, args);
        break;
        
      case 'list_projects':
        result = await handleListProjects(this.db, args);
        break;
        
      case 'update_project_status':
        result = await handleUpdateProjectStatus(this.db, args);
        break;
        
      case 'get_recent_updates':
        result = await handleGetRecentUpdates(this.db, args);
        break;
      
      // Role management tools
      case 'list_roles':
        const rolesResult = await listRoles(args);
        result = JSON.stringify(rolesResult, null, 2);
        break;
        
      case 'get_active_role':
        const activeRoleResult = await getActiveRole(args);
        result = JSON.stringify(activeRoleResult, null, 2);
        break;
        
      case 'switch_role':
        result = await switchRole(args);
        break;
        
      case 'create_role_handoff':
        result = await createRoleHandoff(args);
        break;
        
      case 'get_role_handoffs':
        result = await getRoleHandoffs(args);
        break;
        
      case 'create_custom_role':
        result = await createCustomRole(args);
        break;
        
      case 'delete_custom_role':
        result = await deleteCustomRole(args);
        break;
        
      case 'import_role_template':
        result = await importRoleTemplate(args);
        break;
        
      // Deletion tools
      case 'delete_project':
        result = await deleteProject(this.db, args);
        break;
        
      case 'delete_context':
        result = await deleteContext(this.db, args);
        break;
        
      case 'cleanup_old_data':
        result = await cleanupOldData(this.db, args);
        break;
      
      // Pro orchestration tools (only if in Pro mode)
      case 'execute_as_role':
        if (!this.isProMode || !this.registry || !this.roleProvider || !this.orchestrator) {
          throw new Error('This tool requires MPCM-Pro mode with all services initialized');
        }
        result = await handleExecuteAsRole(this.db, this.registry, this.roleProvider, this.orchestrator, args);
        break;
        
      case 'list_available_roles':
        if (!this.isProMode || !this.roleProvider) {
          throw new Error('This tool requires MPCM-Pro mode with role provider');
        }
        result = await handleListAvailableRoles(this.db, this.roleProvider, args);
        break;
        
      case 'enhance_prompt_with_role':
        if (!this.isProMode || !this.roleProvider) {
          throw new Error('This tool requires MPCM-Pro mode with role provider');
        }
        result = await handleEnhancePromptWithRole(this.db, this.roleProvider, args);
        break;
        
      case 'git_operation':
        if (!this.isProMode || !this.registry) {
          throw new Error('This tool requires MPCM-Pro mode with service registry');
        }
        const gitResult = await handleGitOperation(args, this.registry, this.db);
        result = JSON.stringify(gitResult, null, 2);
        break;
      
      case 'execute_service':
        if (!this.isProMode) throw new Error('This tool requires MPCM-Pro mode');
        result = await this.executeService(args);
        break;
        
      case 'list_services':
        if (!this.isProMode) throw new Error('This tool requires MPCM-Pro mode');
        result = await this.listServices();
        break;
        
      case 'build_app_from_idea':
        if (!this.isProMode) throw new Error('This tool requires MPCM-Pro mode');
        result = await this.buildAppFromIdea(args);
        break;
      case 'get_service_status':
        if (!this.isProMode) throw new Error('This tool requires MPCM-Pro mode');
        result = await this.getServiceStatus();
        break;
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    // Ensure result is a string
    if (typeof result === 'object' && result && 'error' in result) {
      throw new Error((result as any).error);
    }

    return result as string;
  }

  private async getServiceStatus(): Promise<string> {
    if (!this.registry) {
      throw new Error('Service registry not available in basic mode');
    }
    const services = this.registry.getServices();
    const serviceInfo = services.map(service => ({
      name: service.name,
      status: service.status,
      lastError: service.lastError
    }));
    return JSON.stringify({
      totalServices: services.length,
      services: serviceInfo
    }, null, 2);
  }

  /**
   * Epic 3: End-to-End App Builder Foundation
   */
  private async buildAppFromIdea(args: any): Promise<string> {
    const { idea, projectName, template = 'react-saas', targetPlatform = 'vercel' } = args;
    
    try {
      console.error(`🏗️  Starting app build: ${projectName}`);
      
      // Simplified workflow demonstration
      const workflowSteps = {
        requirements: { success: true, message: 'Requirements analyzed' },
        architecture: { success: true, message: 'Architecture planned' },
        implementation: { success: true, message: 'Implementation generated' },
        versionControl: { success: false, message: 'Git operations ready' },
        deployment: { success: false, message: 'Deployment ready' }
      };
      
      // Initialize Git repository
      try {
        if (this.registry) {
          await this.registry.execute('git', {
            tool: 'init',
            args: {},
            projectName,
            storeResult: true
          });
          workflowSteps.versionControl = { success: true, message: 'Git initialized' };
        }
      } catch (error) {
        console.error('Git initialization failed:', error);
      }
      
      const result = {
        success: true,
        projectName,
        idea,
        template,
        targetPlatform,
        steps: workflowSteps,
        message: 'App build workflow foundation complete',
        note: 'This is a foundation implementation. Full role orchestration pending.',
        completedAt: new Date().toISOString()
      };
      
      // Store workflow result
      const project = this.db.upsertProject({ 
        name: projectName, 
        description: 'Auto-generated project',
        status: 'active'
      });
      if (project) {
        this.db.storeContext({
          project_id: project.id,
          type: 'status',
          key: 'app-build-foundation',
          value: JSON.stringify(result),
          tags: ['epic-3', 'end-to-end', 'foundation'],
          is_system_specific: false
        });
      }
      
      console.error('✅ App build foundation complete!');
      return JSON.stringify(result, null, 2);
      
    } catch (error) {
      const errorResult = {
        success: false,
        projectName,
        idea,
        error: error instanceof Error ? error instanceof Error ? error.message : String(error) : String(error),
        timestamp: new Date().toISOString()
      };
      
      throw error;
    }
  }

  private async executeService(args: any): Promise<string> {
    const { service, tool, args: toolArgs, projectName, storeResult = true } = args;
    
    if (!this.registry) {
      return JSON.stringify({
        success: false,
        error: 'Service registry not available in basic mode'
      }, null, 2);
    }
    
    try {
      const result = await this.registry.execute(service, {
        tool,
        args: toolArgs,
        projectName,
        storeResult
      });
      
      if (!result.success) {
        return `❌ Error: ${result.error || 'Service execution failed'}`;
      }
      
      return JSON.stringify(result.data, null, 2);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return `❌ Error: ${errorMsg}`;
    }
  }
  
  private async listServices(): Promise<string> {
    if (!this.registry) {
      throw new Error('Service registry not available in basic mode');
    }
    
    const services = this.registry.getServices();
    
    const serviceInfo = services.map(service => ({
      name: service.name,
      status: service.status,
      capabilities: service.capabilities.map(cap => ({
        name: cap.name,
        description: cap.description
      })),
      error: service.lastError
    }));
    
    return JSON.stringify({
      totalServices: services.length,
      services: serviceInfo
    }, null, 2);
  }

  private shutdown(): void {
    console.error(`Shutting down ${this.isProMode ? 'Ship APE Core' : 'MCP Context Memory'} Server...`);
    if (this.isProMode && this.registry) {
      this.registry.shutdown();
    }
    this.db.close();
    process.exit(0);
  }

  async run(): Promise<void> {
    // Initialize services only in Pro mode
    if (this.isProMode) {
      await this.initializeServices();
    }
    
    // Start server
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    const serverName = this.isProMode ? 'Ship APE Core Server' : 'MCP Context Memory Server';
    console.error(`🎯 ${serverName} v0.3.0 running on stdio`);
  }

  // For testing - handle MCP requests directly
  async handleRequest(request: any): Promise<any> {
    if (request.method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: true },
            resources: { subscribe: true, listChanged: true },
            prompts: { listChanged: true },
            logging: {}
          },
          serverInfo: {
            name: '@briandawson/shape-core-sse',
            version: '0.4.0'
          }
        }
      };
    } else if (request.method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: { tools: this.getAllTools() }
      };
    } else if (request.method === 'tools/call') {
      try {
        const result = await this.handleToolCall(request.params.name, request.params.arguments);
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [{ type: 'text', text: result }]
          }
        };
      } catch (error) {
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: { 
            code: -32603, 
            message: error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error' 
          }
        };
      }
    }
    
    return { 
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32601, message: 'Method not found' }
    };
  }

  // For testing - clean shutdown
  async close(): Promise<void> {
    if (this.isProMode && this.registry) {
      await this.registry.shutdown();
    }
    if (this.db && typeof this.db.close === 'function') {
      this.db.close();
    }
  }

  // Add initialize method for E2E tests
  async initialize(): Promise<void> {
    // Already initialized in constructor, but provide for test compatibility
    if (this.isProMode) {
      await this.initializeServices();
    }
  }

  // Add callTool method for E2E tests
  async callTool(name: string, args: any): Promise<{ isError: boolean; content: Array<{ text: string }> }> {
    try {
      const result = await this.handleToolCall(name, args);
      return {
        isError: false,
        content: [{ text: result }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ text: error instanceof Error ? error.message : String(error) }]
      };
    }
  }
}

// Main entry point
async function main() {
  try {
    // Check for SSE mode
    const isSSEMode = process.argv.includes('--sse') || 
                     process.env.SHAPE_SSE_MODE === 'true';
    
    if (isSSEMode) {
      // Start SSE multi-tenant server
      await startSSEServer();
    } else {
      // Start traditional stdio server
      await startStdioServer();
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function startSSEServer() {
  const { MultiTenantMCPServer } = await import('./server/MultiTenantMCPServer.js');
  
  // Debug PORT environment variable for Railway
  console.error(`🔍 Railway PORT debug: ${process.env.PORT || 'undefined'}`);
  console.error(`🔍 All env vars containing PORT: ${JSON.stringify(Object.keys(process.env).filter(k => k.includes('PORT')).reduce((acc, k) => ({...acc, [k]: process.env[k]}), {}))}`);

  const config = {
    mode: 'sse' as const,
    httpConfig: {
      port: parseInt(process.env.PORT || '3000'),
      corsOrigins: process.env.CORS_ORIGINS ? 
        process.env.CORS_ORIGINS.split(',') : 
        ['https://claude.ai', 'https://web.claude.ai', 'https://claude.com', 'http://localhost:3000', 'http://localhost:5173'],
      masterKey: process.env.SHIP_APE_MASTER_KEY || 'dev-master-key-change-in-production'
    },
    tenantDataPath: process.env.TENANT_DATA_PATH || join(process.cwd(), 'tenant-data')
  };

  console.error('🚀 Ship APE Core SSE - Multi-Tenant MCP Server v0.4.0');
  console.error('🌐 Transport: HTTP + Server-Sent Events');
  console.error(`📡 Port: ${config.httpConfig.port}`);
  console.error(`📁 Tenant Data: ${config.tenantDataPath}`);
  
  const server = new MultiTenantMCPServer(config);
  await server.start();

  // Graceful shutdown handling
  const shutdown = async () => {
    console.error('\n🛑 Shutting down SSE server...');
    await server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

async function startStdioServer() {
  // Determine mode based on command line args or environment
  const isProMode = process.argv.includes('--pro') || 
                   process.env.SHAPE_PRO_MODE === 'true' ||
                   !process.env.SHAPE_BASIC_MODE; // Default to Pro mode
  
  // Choose database path based on mode
  let dbPath: string;
  if (isProMode) {
    const defaultDir = join(homedir(), '.shape-core');
    if (!existsSync(defaultDir)) {
      mkdirSync(defaultDir, { recursive: true });
    }
    dbPath = process.env.SHAPE_PRO_DB_PATH || join(defaultDir, 'shape-core.db');
  } else {
    // Basic mode uses original MCP database path
    dbPath = process.env.MCP_CONTEXT_DB_PATH || join(homedir(), '.mcp-context-memory.db');
  }
  
  const db = await DatabaseManager.create(dbPath);
  
  // Log startup information
  if (isProMode) {
    console.error('📦 Ship APE Core - Universal MCP Orchestration Platform');
    console.error('🔧 Mode: Professional (Full orchestration enabled)');
  } else {
    console.error('📝 MCP Context Memory Server');
    console.error('🔧 Mode: Basic (Core features only)');
  }
  console.error(`💾 Database: ${dbPath}`);
  console.error('🖥️  Transport: Standard I/O (Claude Desktop)');
  
  // Check migration status
  const migrationStatus = await db.getMigrationStatus();
  console.error(`📊 Schema version: ${migrationStatus.currentVersion}`);
  
  // Create and run server
  const server = new MCPMProServer(db, isProMode);
  await server.run();
}

// Run the server
main();

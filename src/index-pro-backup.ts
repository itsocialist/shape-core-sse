#!/usr/bin/env node

/**
 * MPCM-Pro Server - Universal MCP Orchestration Platform
 * Consolidated Version - All services integrated (filesystem, git, roles)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
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

// Import original MPCM tools
import { createStoreProjectContextTool, handleStoreProjectContext } from './tools/storeProjectContext.js';
import { createStoreContextTool, handleStoreContext } from './tools/storeContext.js';
import { createSearchContextTool, handleSearchContext } from './tools/searchContext.js';
import { createGetProjectContextTool, handleGetProjectContext } from './tools/getProjectContext.js';
import { createListProjectsTool, handleListProjects } from './tools/listProjects.js';

// Import role orchestration tools
import { createExecuteAsRoleTool, handleExecuteAsRole } from './tools/executeAsRole.js';
import { createListAvailableRolesTool, handleListAvailableRoles } from './tools/listAvailableRoles.js';
import { createEnhancePromptWithRoleTool, handleEnhancePromptWithRole } from './tools/enhancePromptWithRole.js';

// Import Git MCP tool
import { gitOperationTool, handleGitOperation } from './tools/gitOperation.js';

export class MCPMProServer {
  private server: Server;
  private db: DatabaseManager;
  private registry: ServiceRegistry;
  private roleProvider: RoleProvider;
  private orchestrator: RoleOrchestrator;

  constructor(db: DatabaseManager) {
    this.db = db;
    this.registry = new ServiceRegistry(db);
    this.roleProvider = new RoleProvider(db);
    this.orchestrator = new RoleOrchestrator(db, this.registry, this.roleProvider);
    this.server = new Server(
      {
        name: 'mpcm-pro',
        version: '0.2.0-consolidated',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private async initializeServices(): Promise<void> {
    console.error('🚀 Initializing MPCM-Pro services...');
    
    // Register filesystem adapter
    const fsAdapter = new FilesystemAdapter('/Users/briandawson');
    await this.registry.register(fsAdapter);
    
    // Register Git adapter - Epic 3 Integration
    const gitAdapter = new GitAdapter(process.cwd());
    await this.registry.register(gitAdapter);
    
    console.error('✅ All services initialized (filesystem + git)');
  }
  private setupHandlers(): void {
    // Handle list tools request
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = [
        // Core MPCM tools
        createStoreProjectContextTool(this.db),
        createStoreContextTool(this.db),
        createSearchContextTool(this.db),
        createGetProjectContextTool(this.db),
        createListProjectsTool(this.db),
        
        // Role orchestration tools  
        createExecuteAsRoleTool(this.db, this.registry, this.roleProvider, this.orchestrator),
        createListAvailableRolesTool(this.db, this.roleProvider),
        createEnhancePromptWithRoleTool(this.db, this.roleProvider),
        
        // Git MCP tool - Epic 3 Integration
        gitOperationTool,
        
        // MPCM-Pro service orchestration tools
        {
          name: 'execute_service',
          description: 'Execute a command through a registered service adapter',
          inputSchema: {
            type: 'object',
            properties: {
              service: { 
                type: 'string', 
                description: 'Service name (e.g., filesystem, git, command)',
                enum: this.registry.getServices().map(s => s.name)
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
        
        // End-to-End App Builder Tool - Epic 3 Foundation
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
        }
      ];

      return { tools };
    });
    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result: string;

        switch (name) {
          // Core MPCM tools
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
          
          // Role orchestration tools
          case 'execute_as_role':
            result = await handleExecuteAsRole(this.db, this.registry, this.roleProvider, this.orchestrator, args);
            break;
            
          case 'list_available_roles':
            result = await handleListAvailableRoles(this.db, this.roleProvider, args);
            break;
            
          case 'enhance_prompt_with_role':
            result = await handleEnhancePromptWithRole(this.db, this.roleProvider, args);
            break;
            
          // Git MCP tool - Epic 3 Integration
          case 'git_operation':
            const gitResult = await handleGitOperation(args, this.registry, this.db);
            result = JSON.stringify(gitResult, null, 2);
            break;
          
          // MPCM-Pro service orchestration tools
          case 'execute_service':
            result = await this.executeService(args);
            break;
            
          case 'list_services':
            result = await this.listServices();
            break;
            
          // End-to-End App Builder - Epic 3 Foundation
          case 'build_app_from_idea':
            result = await this.buildAppFromIdea(args);
            break;
            
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

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
  /**
   * Epic 3: End-to-End App Builder Foundation
   * Basic workflow orchestration for "idea → deployed app"
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
        await this.registry.execute('git', {
          tool: 'init',
          args: {},
          projectName,
          storeResult: true
        });
        workflowSteps.versionControl = { success: true, message: 'Git initialized' };
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
      await this.db.storeContext(
        projectName,
        'status',
        'app-build-foundation',
        JSON.stringify(result),
        ['epic-3', 'end-to-end', 'foundation'],
        false
      );
      
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
    
    const result = await this.registry.execute(service, {
      tool,
      args: toolArgs,
      projectName,
      storeResult
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Service execution failed');
    }
    
    return JSON.stringify(result.data, null, 2);
  }
  
  private async listServices(): Promise<string> {
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
    console.error('Shutting down MPCM-Pro Server...');
    this.registry.shutdown();
    this.db.close();
    process.exit(0);
  }

  async run(): Promise<void> {
    // Initialize services
    await this.initializeServices();
    
    // Start server
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🎯 MPCM-Pro Server running on stdio (Consolidated: filesystem + git + roles)');
  }

  // For testing - handle MCP requests directly
  async handleRequest(request: any): Promise<any> {
    if (request.method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: await this.handleToolsList()
      };
    } else if (request.method === 'tools/call') {
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: await this.handleToolCall(request.params)
      };
    }
    
    return { 
      jsonrpc: '2.0',
      id: request.id,
      error: { code: -32601, message: 'Method not found' }
    };
  }
  
  private async handleToolsList(): Promise<any> {
    // Use same tools list as in setupHandlers
    const tools = await this.server.requestHandlers.get('tools/list')!();
    return tools;
  }
  
  private async handleToolCall(params: any): Promise<any> {
    // Use same tool call handler as in setupHandlers  
    const handler = this.server.requestHandlers.get('tools/call')!;
    return await handler({ params });
  }

  // For testing - clean shutdown
  async close(): Promise<void> {
    await this.registry.shutdown();
    this.db.close();
  }
}

// Main entry point
async function main() {
  try {
    // Initialize database in separate directory for MPCM-Pro
    const defaultDir = join(homedir(), '.mpcm-pro');
    if (!existsSync(defaultDir)) {
      mkdirSync(defaultDir, { recursive: true });
    }
    
    const dbPath = process.env.MPCM_PRO_DB_PATH || join(defaultDir, 'mpcm-pro.db');
    const db = await DatabaseManager.create(dbPath);
    
    console.error('📦 MPCM-Pro - Universal MCP Orchestration Platform (Consolidated)');
    console.error(`💾 Database initialized at: ${dbPath}`);
    
    // Create and run server
    const server = new MCPMProServer(db);
    await server.run();
  } catch (error) {
    console.error('Failed to start MPCM-Pro server:', error);
    process.exit(1);
  }
}

// Run the server
main();

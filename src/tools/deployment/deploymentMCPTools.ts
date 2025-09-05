/**
 * MCP Tool definitions for deployment operations
 * Provides deployment functionality through MCP protocol
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { 
  deployApp, 
  getDeploymentStatus, 
  listDeploymentProviders, 
  validateDeploymentConfig,
  DeployAppParams,
  GetDeploymentStatusParams,
  ListDeploymentProvidersParams
} from './deploymentTools.js';

// Validation schemas
const deployAppSchema = z.object({
  projectPath: z.string().min(1, 'Project path is required'),
  platform: z.string().optional().default('auto'),
  environment: z.enum(['preview', 'production']),
  dependencies: z.array(z.string()).optional().default([]),
  roleId: z.string().optional().default('devops'),
  projectId: z.string().min(1, 'Project ID is required')
});

const getDeploymentStatusSchema = z.object({
  deploymentId: z.string().min(1, 'Deployment ID is required')
});

const listDeploymentProvidersSchema = z.object({});

const validateDeploymentConfigSchema = deployAppSchema;

// MCP Tool definitions
export const deployAppTool: Tool = {
  name: 'deploy_app',
  description: 'Deploy an application using configured deployment providers with role-based orchestration. Supports automatic provider selection and dependency resolution.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to the project directory to deploy'
      },
      platform: {
        type: 'string',
        description: 'Deployment platform (vercel, netlify, aws, or auto for automatic selection)',
        default: 'auto'
      },
      environment: {
        type: 'string',
        enum: ['preview', 'production'],
        description: 'Deployment environment'
      },
      dependencies: {
        type: 'array',
        items: { type: 'string' },
        description: 'Template dependencies to resolve (e.g., stripe-integration, auth0-setup)',
        default: []
      },
      roleId: {
        type: 'string',
        description: 'Role ID for context (devops, developer, architect)',
        default: 'devops'
      },
      projectId: {
        type: 'string',
        description: 'Project identifier for context management'
      }
    },
    required: ['projectPath', 'environment', 'projectId']
  }
};

export const getDeploymentStatusTool: Tool = {
  name: 'get_deployment_status',
  description: 'Get the current status of a deployment, including progress, URL, and build logs.',
  inputSchema: {
    type: 'object',
    properties: {
      deploymentId: {
        type: 'string',
        description: 'Deployment ID returned from deploy_app'
      }
    },
    required: ['deploymentId']
  }
};

export const listDeploymentProvidersTool: Tool = {
  name: 'list_deployment_providers',
  description: 'List all available deployment providers and their capabilities.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false
  }
};

export const validateDeploymentConfigTool: Tool = {
  name: 'validate_deployment_config',
  description: 'Validate a deployment configuration without actually deploying. Checks project structure, dependencies, and provider compatibility.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to the project directory to validate'
      },
      platform: {
        type: 'string',
        description: 'Deployment platform (vercel, netlify, aws, or auto for automatic selection)',
        default: 'auto'
      },
      environment: {
        type: 'string',
        enum: ['preview', 'production'],
        description: 'Deployment environment'
      },
      dependencies: {
        type: 'array',
        items: { type: 'string' },
        description: 'Template dependencies to validate',
        default: []
      },
      roleId: {
        type: 'string',
        description: 'Role ID for context (devops, developer, architect)',
        default: 'devops'
      },
      projectId: {
        type: 'string',
        description: 'Project identifier for context management'
      }
    },
    required: ['projectPath', 'environment', 'projectId']
  }
};

// Handler functions
export async function handleDeployApp(args: unknown) {
  const validated = deployAppSchema.parse(args);
  
  try {
    const result = await deployApp(validated);
    
    return {
      success: true,
      deployment: {
        id: result.deploymentId,
        status: result.status,
        url: result.url,
        platform: result.platform,
        environment: result.environment,
        createdAt: result.createdAt,
        logs: result.logs.slice(-5), // Return last 5 logs
        metadata: result.metadata
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'DEPLOYMENT_FAILED'
    };
  }
}

export async function handleGetDeploymentStatus(args: unknown) {
  const validated = getDeploymentStatusSchema.parse(args);
  
  try {
    const status = await getDeploymentStatus(validated);
    
    return {
      success: true,
      status: {
        id: status.deploymentId,
        status: status.status,
        url: status.url,
        lastUpdated: status.lastUpdated,
        progress: status.progress,
        logs: status.buildLogs.slice(-10) // Return last 10 logs
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'STATUS_CHECK_FAILED'
    };
  }
}

export async function handleListDeploymentProviders(args: unknown) {
  const validated = listDeploymentProvidersSchema.parse(args);
  
  try {
    const result = await listDeploymentProviders(validated);
    
    return {
      success: true,
      providers: result.providers,
      count: result.count
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'PROVIDER_LIST_FAILED'
    };
  }
}

export async function handleValidateDeploymentConfig(args: unknown) {
  const validated = validateDeploymentConfigSchema.parse(args);
  
  try {
    const result = await validateDeploymentConfig(validated);
    
    return {
      success: true,
      validation: result
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'VALIDATION_FAILED'
    };
  }
}

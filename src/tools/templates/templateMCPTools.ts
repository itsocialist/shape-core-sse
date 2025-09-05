/**
 * MCP Tool definitions for template operations
 * Provides template functionality through MCP protocol
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { 
  listTemplates,
  getTemplateInfo,
  validateTemplateConfig,
  createProjectFromTemplate,
  searchTemplates,
  getTemplateDeploymentConfig,
  ListTemplatesParams,
  CreateProjectFromTemplateParams,
  ValidateTemplateConfigParams,
  GetTemplateInfoParams
} from './templateTools.js';

// Validation schemas
const listTemplatesSchema = z.object({
  category: z.string().optional(),
  framework: z.string().optional(),
  tags: z.array(z.string()).optional()
});

const getTemplateInfoSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required')
});

const validateTemplateConfigSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  projectName: z.string().min(1, 'Project name is required'),
  projectPath: z.string().min(1, 'Project path is required'),
  variables: z.record(z.string()).optional(),
  selectedRoles: z.array(z.string()).optional(),
  environmentVars: z.record(z.string()).optional()
});

const createProjectFromTemplateSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  projectName: z.string().min(1, 'Project name is required'),
  projectPath: z.string().min(1, 'Project path is required'),
  variables: z.record(z.string()).optional().default({}),
  selectedRoles: z.array(z.string()).optional().default(['developer']),
  environmentVars: z.record(z.string()).optional(),
  roleId: z.string().optional().default('developer'),
  projectId: z.string().min(1, 'Project ID is required')
});

const searchTemplatesSchema = z.object({
  category: z.string().optional(),
  framework: z.string().optional(),
  tags: z.array(z.string()).optional(),
  author: z.string().optional(),
  platform: z.string().optional()
});

// MCP Tool definitions
export const listTemplatesTool: Tool = {
  name: 'list_templates',
  description: 'List available application templates with optional filtering by category, framework, or tags.',
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Filter by template category (saas, landing, web, api, mobile, desktop)'
      },
      framework: {
        type: 'string',
        description: 'Filter by framework (next.js, react, vue, svelte, etc.)'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags (e.g., typescript, auth, payments)'
      }
    },
    additionalProperties: false
  }
};

export const getTemplateInfoTool: Tool = {
  name: 'get_template_info',
  description: 'Get detailed information about a specific template including role workflows, dependencies, and configuration options.',
  inputSchema: {
    type: 'object',
    properties: {
      templateId: {
        type: 'string',
        description: 'ID of the template to get information about'
      }
    },
    required: ['templateId']
  }
};

export const validateTemplateConfigTool: Tool = {
  name: 'validate_template_config',
  description: 'Validate template configuration before creating a project. Checks for missing dependencies and required environment variables.',
  inputSchema: {
    type: 'object',
    properties: {
      templateId: {
        type: 'string',
        description: 'ID of the template to validate'
      },
      projectName: {
        type: 'string',
        description: 'Name of the project to create'
      },
      projectPath: {
        type: 'string',
        description: 'Path where the project will be created'
      },
      variables: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Template variables (e.g., description, author)'
      },
      selectedRoles: {
        type: 'array',
        items: { type: 'string' },
        description: 'Roles to assign for project workflows'
      },
      environmentVars: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Environment variables for the project'
      }
    },
    required: ['templateId', 'projectName', 'projectPath']
  }
};

export const createProjectFromTemplateTool: Tool = {
  name: 'create_project_from_template',
  description: 'Create a new project from a template with role-based workflows. Generates project structure and provides next steps for each role.',
  inputSchema: {
    type: 'object',
    properties: {
      templateId: {
        type: 'string',
        description: 'ID of the template to use'
      },
      projectName: {
        type: 'string',
        description: 'Name of the project to create'
      },
      projectPath: {
        type: 'string',
        description: 'Path where the project will be created'
      },
      variables: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Template variables (e.g., description, author)',
        default: {}
      },
      selectedRoles: {
        type: 'array',
        items: { type: 'string' },
        description: 'Roles to assign for project workflows',
        default: ['developer']
      },
      environmentVars: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Environment variables for the project'
      },
      roleId: {
        type: 'string',
        description: 'Role ID for context management',
        default: 'developer'
      },
      projectId: {
        type: 'string',
        description: 'Project identifier for context management'
      }
    },
    required: ['templateId', 'projectName', 'projectPath', 'projectId']
  }
};

export const searchTemplatesTool: Tool = {
  name: 'search_templates',
  description: 'Search templates with advanced criteria including multiple filters and match reasons.',
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Filter by template category'
      },
      framework: {
        type: 'string',
        description: 'Filter by framework'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by tags'
      },
      author: {
        type: 'string',
        description: 'Filter by author name'
      },
      platform: {
        type: 'string',
        description: 'Filter by deployment platform'
      }
    },
    additionalProperties: false
  }
};

export const getTemplateDeploymentConfigTool: Tool = {
  name: 'get_template_deployment_config',
  description: 'Get deployment configuration for a template to prepare for deployment.',
  inputSchema: {
    type: 'object',
    properties: {
      templateId: {
        type: 'string',
        description: 'ID of the template'
      }
    },
    required: ['templateId']
  }
};

// Handler functions
export async function handleListTemplates(args: unknown) {
  const validated = listTemplatesSchema.parse(args);
  
  try {
    const result = await listTemplates(validated);
    
    return {
      success: true,
      templates: result.templates,
      count: result.count,
      filters: {
        category: validated.category,
        framework: validated.framework,
        tags: validated.tags
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'LIST_TEMPLATES_FAILED'
    };
  }
}

export async function handleGetTemplateInfo(args: unknown) {
  const validated = getTemplateInfoSchema.parse(args);
  
  try {
    const result = await getTemplateInfo(validated);
    
    return {
      success: true,
      template: result.template
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'GET_TEMPLATE_INFO_FAILED'
    };
  }
}

export async function handleValidateTemplateConfig(args: unknown) {
  const validated = validateTemplateConfigSchema.parse(args);
  
  try {
    const result = await validateTemplateConfig(validated);
    
    return {
      success: true,
      validation: result
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'VALIDATE_TEMPLATE_CONFIG_FAILED'
    };
  }
}

export async function handleCreateProjectFromTemplate(args: unknown) {
  const validated = createProjectFromTemplateSchema.parse(args);
  
  try {
    const result = await createProjectFromTemplate(validated);
    
    return {
      success: true,
      installation: {
        projectPath: result.projectPath,
        templateId: result.templateId,
        createdFiles: result.createdFiles,
        roleAssignments: result.roleAssignments,
        nextSteps: result.nextSteps,
        deploymentReady: result.deploymentReady
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'CREATE_PROJECT_FAILED'
    };
  }
}

export async function handleSearchTemplates(args: unknown) {
  const validated = searchTemplatesSchema.parse(args);
  
  try {
    const result = await searchTemplates(validated);
    
    return {
      success: true,
      templates: result.templates,
      count: result.count,
      criteria: result.criteria
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'SEARCH_TEMPLATES_FAILED'
    };
  }
}

export async function handleGetTemplateDeploymentConfig(args: unknown) {
  const validated = getTemplateInfoSchema.parse(args);
  
  try {
    const result = await getTemplateDeploymentConfig(validated);
    
    return {
      success: true,
      deploymentConfig: result.deploymentConfig,
      dependencies: result.dependencies,
      environmentVars: result.environmentVars
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      code: 'GET_DEPLOYMENT_CONFIG_FAILED'
    };
  }
}

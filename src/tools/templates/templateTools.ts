/**
 * MCP Tools for template operations
 * Integrates template system with Claude Desktop
 */

import { 
  TemplateConfig, 
  TemplateSearchCriteria,
  TemplateInstallation 
} from '../../templates/types.js';
import { createTemplateRegistry } from '../../templates/factory.js';
import { getRoleContext, storeDeploymentContext } from '../context/roleUtils.js';

export interface ListTemplatesParams {
  category?: string;
  framework?: string;
  tags?: string[];
}

export interface CreateProjectFromTemplateParams {
  templateId: string;
  projectName: string;
  projectPath: string;
  variables?: Record<string, string>;
  selectedRoles?: string[];
  environmentVars?: Record<string, string>;
  roleId?: string;
  projectId: string;
}

export interface ValidateTemplateConfigParams {
  templateId: string;
  projectName: string;
  projectPath: string;
  variables?: Record<string, string>;
  selectedRoles?: string[];
  environmentVars?: Record<string, string>;
}

export interface GetTemplateInfoParams {
  templateId: string;
}

/**
 * List available templates with optional filtering
 */
export async function listTemplates(params: ListTemplatesParams) {
  const registry = createTemplateRegistry();
  
  let templates = registry.listAll();
  
  if (params.category) {
    templates = registry.listByCategory(params.category);
  } else if (params.framework) {
    templates = registry.searchByFramework(params.framework);
  } else if (params.tags && params.tags.length > 0) {
    templates = registry.searchByTags(params.tags);
  }
  
  // Return simplified template info for listing
  return {
    templates: templates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      framework: template.framework,
      tags: template.tags,
      author: template.author,
      version: template.version,
      supportedPlatforms: template.deploymentConfig.supportedPlatforms,
      requiredEnvVars: template.environmentVars.required.length,
      availableRoles: Object.keys(template.roleWorkflows)
    })),
    count: templates.length
  };
}

/**
 * Get detailed information about a specific template
 */
export async function getTemplateInfo(params: GetTemplateInfoParams) {
  const registry = createTemplateRegistry();
  const template = registry.getTemplate(params.templateId);
  
  if (!template) {
    throw new Error(`Template '${params.templateId}' not found`);
  }
  
  return {
    template: {
      ...template,
      // Add helpful metadata
      fileCount: template.files.length,
      dependencyCount: template.dependencies.length,
      roleCount: Object.keys(template.roleWorkflows).length
    }
  };
}

/**
 * Validate template configuration before creating project
 */
export async function validateTemplateConfig(params: ValidateTemplateConfigParams) {
  const registry = createTemplateRegistry();
  
  const config: TemplateConfig = {
    templateId: params.templateId,
    projectName: params.projectName,
    projectPath: params.projectPath,
    variables: params.variables || {},
    selectedRoles: params.selectedRoles || [],
    environmentVars: params.environmentVars
  };
  
  const validation = await registry.validateConfig(config);
  
  return {
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings,
    missingDependencies: validation.missingDependencies,
    requiredEnvironmentVars: validation.requiredEnvironmentVars,
    recommendations: generateRecommendations(validation, config)
  };
}

/**
 * Create a new project from template
 */
export async function createProjectFromTemplate(params: CreateProjectFromTemplateParams): Promise<TemplateInstallation> {
  const registry = createTemplateRegistry();
  
  const config: TemplateConfig = {
    templateId: params.templateId,
    projectName: params.projectName,
    projectPath: params.projectPath,
    variables: params.variables || {},
    selectedRoles: params.selectedRoles || ['developer'],
    environmentVars: params.environmentVars
  };
  
  // Validate configuration first
  const validation = await registry.validateConfig(config);
  if (!validation.valid) {
    throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
  }
  
  // Create project from template
  const installation = await registry.createProject(config);
  
  // Store project context if role and project info provided
  if (params.roleId && params.projectId) {
    await storeDeploymentContext(
      params.roleId,
      params.projectId,
      {
        templateId: params.templateId,
        projectPath: params.projectPath,
        createdAt: new Date(),
        installation
      }
    );
  }
  
  return installation;
}

/**
 * Search templates with advanced criteria
 */
export async function searchTemplates(criteria: TemplateSearchCriteria) {
  const registry = createTemplateRegistry();
  const results = registry.search(criteria);
  
  return {
    templates: results.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      framework: template.framework,
      tags: template.tags,
      matchReasons: calculateMatchReasons(template, criteria)
    })),
    count: results.length,
    criteria
  };
}

/**
 * Get deployment configuration for a template
 */
export async function getTemplateDeploymentConfig(params: GetTemplateInfoParams) {
  const registry = createTemplateRegistry();
  const template = registry.getTemplate(params.templateId);
  
  if (!template) {
    throw new Error(`Template '${params.templateId}' not found`);
  }
  
  return {
    deploymentConfig: template.deploymentConfig,
    dependencies: template.dependencies,
    environmentVars: template.environmentVars,
    isDeploymentReady: (config: TemplateConfig) => 
      registry.isDeploymentReady(params.templateId, config)
  };
}

// Helper functions

function generateRecommendations(validation: any, config: TemplateConfig): string[] {
  const recommendations: string[] = [];
  
  if (validation.requiredEnvironmentVars.length > 0) {
    recommendations.push('Consider using a .env.example file to document required environment variables');
  }
  
  if (config.selectedRoles.length === 0) {
    recommendations.push('Select at least one role to get role-specific guidance and workflows');
  }
  
  if (validation.missingDependencies.length > 0) {
    recommendations.push('Install missing dependencies before deployment');
  }
  
  return recommendations;
}

function calculateMatchReasons(template: any, criteria: TemplateSearchCriteria): string[] {
  const reasons: string[] = [];
  
  if (criteria.category && template.category === criteria.category) {
    reasons.push(`Matches category: ${criteria.category}`);
  }
  
  if (criteria.framework && template.framework === criteria.framework) {
    reasons.push(`Uses framework: ${criteria.framework}`);
  }
  
  if (criteria.tags) {
    const matchingTags = template.tags.filter((tag: string) => 
      criteria.tags!.includes(tag)
    );
    if (matchingTags.length > 0) {
      reasons.push(`Has tags: ${matchingTags.join(', ')}`);
    }
  }
  
  return reasons;
}

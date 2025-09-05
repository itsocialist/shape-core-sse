/**
 * Template Registry Implementation
 * Manages application templates and project creation
 */

import { 
  Template, 
  TemplateRegistry as ITemplateRegistry, 
  TemplateConfig, 
  TemplateValidation, 
  TemplateInstallation,
  TemplateSearchCriteria 
} from './types.js';

export class TemplateRegistry implements ITemplateRegistry {
  private templates = new Map<string, Template>();

  /**
   * Register a new template
   */
  register(template: Template): void {
    this.templates.set(template.id, template);
  }

  /**
   * Get a template by ID
   */
  getTemplate(id: string): Template | null {
    return this.templates.get(id) || null;
  }

  /**
   * List all registered templates
   */
  listAll(): Template[] {
    return Array.from(this.templates.values());
  }

  /**
   * List templates by category
   */
  listByCategory(category: string): Template[] {
    return this.listAll().filter(template => template.category === category);
  }

  /**
   * Search templates by framework
   */
  searchByFramework(framework: string): Template[] {
    return this.listAll().filter(template => 
      template.framework.toLowerCase() === framework.toLowerCase()
    );
  }

  /**
   * Search templates by tags
   */
  searchByTags(tags: string[]): Template[] {
    return this.listAll().filter(template =>
      tags.some(tag => template.tags.includes(tag))
    );
  }

  /**
   * Advanced search with multiple criteria
   */
  search(criteria: TemplateSearchCriteria): Template[] {
    let results = this.listAll();

    if (criteria.category) {
      results = results.filter(t => t.category === criteria.category);
    }

    if (criteria.framework) {
      results = results.filter(t => 
        t.framework.toLowerCase() === criteria.framework!.toLowerCase()
      );
    }

    if (criteria.tags && criteria.tags.length > 0) {
      results = results.filter(t =>
        criteria.tags!.some(tag => t.tags.includes(tag))
      );
    }

    if (criteria.author) {
      results = results.filter(t => 
        t.author.toLowerCase().includes(criteria.author!.toLowerCase())
      );
    }

    if (criteria.platform) {
      results = results.filter(t =>
        t.deploymentConfig.supportedPlatforms.includes(criteria.platform!)
      );
    }

    return results;
  }

  /**
   * Validate template configuration
   */
  async validateConfig(config: TemplateConfig): Promise<TemplateValidation> {
    const template = this.getTemplate(config.templateId);
    
    if (!template) {
      return {
        valid: false,
        errors: [`Template '${config.templateId}' not found`],
        warnings: [],
        missingDependencies: [],
        requiredEnvironmentVars: []
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const missingDependencies: string[] = [];
    const requiredEnvironmentVars: string[] = [];

    // Validate project name
    if (!config.projectName || config.projectName.trim().length === 0) {
      errors.push('Project name is required');
    }

    // Validate project path
    if (!config.projectPath || config.projectPath.trim().length === 0) {
      errors.push('Project path is required');
    }

    // Check required environment variables
    for (const envVar of template.environmentVars.required) {
      if (!config.environmentVars || !config.environmentVars[envVar]) {
        errors.push(`Missing required environment variable: ${envVar}`);
        requiredEnvironmentVars.push(envVar);
      }
    }

    // Check dependencies (mock validation for now)
    for (const dependency of template.dependencies) {
      // In real implementation, check if dependency is available
      if (dependency === 'nonexistent-dependency') {
        missingDependencies.push(dependency);
        errors.push(`Missing dependency: ${dependency}`);
      }
    }

    // Validate selected roles
    if (!config.selectedRoles || config.selectedRoles.length === 0) {
      warnings.push('No roles selected. Project will be created without role assignments.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      missingDependencies,
      requiredEnvironmentVars
    };
  }

  /**
   * Create a new project from template
   */
  async createProject(config: TemplateConfig): Promise<TemplateInstallation> {
    const validation = await this.validateConfig(config);
    
    if (!validation.valid) {
      throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
    }

    const template = this.getTemplate(config.templateId)!;

    // Mock file creation for testing
    const createdFiles = template.files.map(file => file.path);

    // Generate role-specific next steps
    const nextSteps = config.selectedRoles.map(role => {
      const workflow = template.roleWorkflows[role];
      return {
        role,
        steps: workflow ? workflow.steps : [`Setup ${role} environment`]
      };
    });

    // Check if deployment is ready
    const deploymentReady = this.isDeploymentReady(config.templateId, config);

    return {
      projectPath: config.projectPath,
      templateId: config.templateId,
      createdFiles,
      roleAssignments: config.selectedRoles,
      nextSteps,
      deploymentReady
    };
  }

  /**
   * Update an existing template
   */
  updateTemplate(id: string, template: Partial<Template>): void {
    const existing = this.templates.get(id);
    if (!existing) {
      throw new Error(`Template '${id}' not found`);
    }

    const updated = { ...existing, ...template };
    this.templates.set(id, updated);
  }

  /**
   * Remove a template
   */
  removeTemplate(id: string): void {
    if (!this.templates.has(id)) {
      throw new Error(`Template '${id}' not found`);
    }
    
    this.templates.delete(id);
  }

  /**
   * Get deployment configuration for a template
   */
  getDeploymentConfig(templateId: string): any {
    const template = this.getTemplate(templateId);
    return template ? template.deploymentConfig : null;
  }

  /**
   * Check if template is ready for deployment
   */
  isDeploymentReady(templateId: string, config: TemplateConfig): boolean {
    const template = this.getTemplate(templateId);
    if (!template) return false;

    // Check if all required environment variables are provided
    const hasRequiredEnvVars = template.environmentVars.required.every(envVar =>
      config.environmentVars && config.environmentVars[envVar]
    );

    // Check if dependencies are resolved
    const dependenciesResolved = template.dependencies.length === 0 || 
      template.dependencies.every(dep => dep !== 'nonexistent-dependency');

    return hasRequiredEnvVars && dependenciesResolved;
  }
}

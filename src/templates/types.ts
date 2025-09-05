/**
 * Types for the Application Template System
 * Defines template structure, configuration, and role workflows
 */

export interface Template {
  // Template metadata
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: 'saas' | 'landing' | 'web' | 'api' | 'mobile' | 'desktop';
  tags: string[];
  framework: string;

  // Template dependencies and configuration
  dependencies: string[];
  environmentVars: {
    required: string[];
    optional: string[];
  };

  // Deployment configuration
  deploymentConfig: {
    supportedPlatforms: string[];
    preferredPlatform: string;
    buildCommand: string;
    environmentTypes: ('preview' | 'production')[];
  };

  // Role-specific workflows
  roleWorkflows: Record<string, RoleWorkflow>;

  // Template files and structure
  files: TemplateFile[];
}

export interface RoleWorkflow {
  steps: string[];
  outputs: string[];
  dependencies?: string[]; // Other roles that must complete first
}

export interface TemplateFile {
  path: string;
  type: 'json' | 'tsx' | 'ts' | 'js' | 'css' | 'md' | 'txt' | 'yml' | 'yaml';
  template: boolean; // Whether file content should be processed for variables
  content?: string; // Template content with variables like {{projectName}}
  binary?: boolean; // For images, fonts, etc.
}

export interface TemplateConfig {
  templateId: string;
  projectName: string;
  projectPath: string;
  variables: Record<string, string>;
  selectedRoles: string[];
  environmentVars?: Record<string, string>;
  customizations?: Record<string, any>;
}

export interface TemplateValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingDependencies: string[];
  requiredEnvironmentVars: string[];
}

export interface TemplateInstallation {
  projectPath: string;
  templateId: string;
  createdFiles: string[];
  roleAssignments: string[];
  nextSteps: RoleNextSteps[];
  deploymentReady: boolean;
  generatedConfig?: Record<string, any>;
}

export interface RoleNextSteps {
  role: string;
  steps: string[];
  priority?: 'high' | 'medium' | 'low';
}

export interface ProjectTemplate {
  template: Template;
  config: TemplateConfig;
  installation: TemplateInstallation;
  createdAt: Date;
  status: 'created' | 'in_progress' | 'completed' | 'failed';
}

export interface TemplateSearchCriteria {
  category?: string;
  framework?: string;
  tags?: string[];
  author?: string;
  platform?: string;
}

export interface TemplateRegistry {
  // Registration and retrieval
  register(template: Template): void;
  getTemplate(id: string): Template | null;
  listAll(): Template[];
  listByCategory(category: string): Template[];
  searchByFramework(framework: string): Template[];
  searchByTags(tags: string[]): Template[];
  search(criteria: TemplateSearchCriteria): Template[];

  // Project creation
  validateConfig(config: TemplateConfig): Promise<TemplateValidation>;
  createProject(config: TemplateConfig): Promise<TemplateInstallation>;
  
  // Template management
  updateTemplate(id: string, template: Partial<Template>): void;
  removeTemplate(id: string): void;
  
  // Integration with deployment system
  getDeploymentConfig(templateId: string): any;
  isDeploymentReady(templateId: string, config: TemplateConfig): boolean;
}

/**
 * Built-in template categories
 */
export const TEMPLATE_CATEGORIES = {
  SAAS: 'saas',
  LANDING: 'landing', 
  WEB: 'web',
  API: 'api',
  MOBILE: 'mobile',
  DESKTOP: 'desktop'
} as const;

/**
 * Common template frameworks
 */
export const TEMPLATE_FRAMEWORKS = {
  NEXTJS: 'next.js',
  REACT: 'react',
  VUE: 'vue',
  SVELTE: 'svelte',
  NUXT: 'nuxt',
  GATSBY: 'gatsby',
  ASTRO: 'astro',
  EXPRESS: 'express',
  FASTAPI: 'fastapi',
  DJANGO: 'django',
  RAILS: 'rails'
} as const;

/**
 * Template variable processing
 */
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  description: string;
  required: boolean;
  default?: any;
  options?: string[]; // For select type
  validation?: RegExp;
}

export interface TemplateProcessor {
  processTemplate(content: string, variables: Record<string, any>): string;
  validateVariables(variables: Record<string, any>, schema: TemplateVariable[]): string[];
  extractVariables(content: string): string[];
}

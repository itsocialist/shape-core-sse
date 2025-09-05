/**
 * Tests for template MCP tools
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  listTemplatesTool,
  getTemplateInfoTool,
  validateTemplateConfigTool,
  createProjectFromTemplateTool,
  searchTemplatesTool,
  getTemplateDeploymentConfigTool,
  handleListTemplates,
  handleGetTemplateInfo,
  handleValidateTemplateConfig,
  handleCreateProjectFromTemplate,
  handleSearchTemplates,
  handleGetTemplateDeploymentConfig
} from '../templateMCPTools.js';

describe('Template MCP Tool Schemas', () => {
  describe('listTemplatesTool', () => {
    it('should have correct tool definition', () => {
      expect(listTemplatesTool.name).toBe('list_templates');
      expect(listTemplatesTool.description).toContain('List available application templates');
      expect(listTemplatesTool.inputSchema.type).toBe('object');
      
      const { properties } = listTemplatesTool.inputSchema;
      expect(properties.category).toBeDefined();
      expect(properties.framework).toBeDefined();
      expect(properties.tags).toBeDefined();
    });

    it('should not require any parameters', () => {
      expect(listTemplatesTool.inputSchema.required).toBeUndefined();
    });
  });

  describe('getTemplateInfoTool', () => {
    it('should have correct tool definition', () => {
      expect(getTemplateInfoTool.name).toBe('get_template_info');
      expect(getTemplateInfoTool.description).toContain('Get detailed information');
      expect(getTemplateInfoTool.inputSchema.required).toEqual(['templateId']);
    });
  });

  describe('createProjectFromTemplateTool', () => {
    it('should have correct required parameters', () => {
      expect(createProjectFromTemplateTool.inputSchema.required).toEqual([
        'templateId', 'projectName', 'projectPath', 'projectId'
      ]);
    });

    it('should have default values for optional parameters', () => {
      const { properties } = createProjectFromTemplateTool.inputSchema;
      expect(properties.variables.default).toEqual({});
      expect(properties.selectedRoles.default).toEqual(['developer']);
      expect(properties.roleId.default).toBe('developer');
    });
  });

  it('should have unique tool names', () => {
    const toolNames = [
      listTemplatesTool.name,
      getTemplateInfoTool.name,
      validateTemplateConfigTool.name,
      createProjectFromTemplateTool.name,
      searchTemplatesTool.name,
      getTemplateDeploymentConfigTool.name
    ];

    const uniqueNames = new Set(toolNames);
    expect(uniqueNames.size).toBe(toolNames.length);
  });
});

describe('Template MCP Tool Handlers', () => {
  describe('handleListTemplates', () => {
    it('should list all templates without filters', async () => {
      const result = await handleListTemplates({});
      
      expect(result.success).toBe(true);
      expect(result.templates).toBeDefined();
      expect(result.count).toBeGreaterThan(0);
      expect(result.filters).toEqual({
        category: undefined,
        framework: undefined,
        tags: undefined
      });
    });

    it('should filter templates by category', async () => {
      const result = await handleListTemplates({ category: 'saas' });
      
      expect(result.success).toBe(true);
      expect(result.templates).toBeDefined();
      expect(result.filters.category).toBe('saas');
      
      // Check that all returned templates are SaaS
      result.templates.forEach((template: any) => {
        expect(template.category).toBe('saas');
      });
    });

    it('should filter templates by framework', async () => {
      const result = await handleListTemplates({ framework: 'next.js' });
      
      expect(result.success).toBe(true);
      expect(result.templates).toBeDefined();
      expect(result.filters.framework).toBe('next.js');
      
      // Check that all returned templates use Next.js
      result.templates.forEach((template: any) => {
        expect(template.framework).toBe('next.js');
      });
    });

    it('should filter templates by tags', async () => {
      const result = await handleListTemplates({ tags: ['saas'] });
      
      expect(result.success).toBe(true);
      expect(result.templates).toBeDefined();
      expect(result.filters.tags).toEqual(['saas']);
    });
  });

  describe('handleGetTemplateInfo', () => {
    it('should get template info for valid template', async () => {
      const result = await handleGetTemplateInfo({ templateId: 'nextjs-saas-starter' });
      
      expect(result.success).toBe(true);
      expect(result.template).toBeDefined();
      expect(result.template.id).toBe('nextjs-saas-starter');
      expect(result.template.name).toBe('Next.js SaaS Starter');
      expect(result.template.fileCount).toBeGreaterThan(0);
      expect(result.template.roleCount).toBeGreaterThan(0);
    });

    it('should handle non-existent template', async () => {
      const result = await handleGetTemplateInfo({ templateId: 'non-existent' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.code).toBe('GET_TEMPLATE_INFO_FAILED');
    });

    it('should validate input parameters', async () => {
      await expect(handleGetTemplateInfo({})).rejects.toThrow();
    });
  });

  describe('handleValidateTemplateConfig', () => {
    it('should validate valid configuration', async () => {
      const result = await handleValidateTemplateConfig({
        templateId: 'nextjs-saas-starter',
        projectName: 'my-saas-app',
        projectPath: '/Users/test/my-saas-app',
        environmentVars: {
          DATABASE_URL: 'postgres://localhost/mydb',
          NEXTAUTH_SECRET: 'secret123',
          STRIPE_SECRET_KEY: 'sk_test_123'
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.validation.valid).toBe(true);
      expect(result.validation.errors).toHaveLength(0);
    });

    it('should detect missing required environment variables', async () => {
      const result = await handleValidateTemplateConfig({
        templateId: 'nextjs-saas-starter',
        projectName: 'my-saas-app',
        projectPath: '/Users/test/my-saas-app'
        // Missing required environment variables
      });
      
      expect(result.success).toBe(true);
      expect(result.validation.valid).toBe(false);
      expect(result.validation.errors.length).toBeGreaterThan(0);
      expect(result.validation.requiredEnvironmentVars.length).toBeGreaterThan(0);
    });

    it('should provide recommendations', async () => {
      const result = await handleValidateTemplateConfig({
        templateId: 'nextjs-saas-starter',
        projectName: 'my-saas-app',
        projectPath: '/Users/test/my-saas-app',
        selectedRoles: [] // No roles selected
      });
      
      expect(result.success).toBe(true);
      expect(result.validation.recommendations).toBeDefined();
      expect(result.validation.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('handleCreateProjectFromTemplate', () => {
    it('should create project from valid template', async () => {
      const result = await handleCreateProjectFromTemplate({
        templateId: 'nextjs-landing-page', // Use landing page (no required env vars)
        projectName: 'my-landing-page',
        projectPath: '/Users/test/my-landing-page',
        projectId: 'test-project-123',
        selectedRoles: ['developer', 'designer']
      });
      
      expect(result.success).toBe(true);
      expect(result.installation).toBeDefined();
      expect(result.installation.projectPath).toBe('/Users/test/my-landing-page');
      expect(result.installation.templateId).toBe('nextjs-landing-page');
      expect(result.installation.roleAssignments).toEqual(['developer', 'designer']);
      expect(result.installation.nextSteps.length).toBeGreaterThan(0);
    });

    it('should fail with invalid template configuration', async () => {
      const result = await handleCreateProjectFromTemplate({
        templateId: 'nextjs-saas-starter',
        projectName: 'my-saas-app',
        projectPath: '/Users/test/my-saas-app',
        projectId: 'test-project-123'
        // Missing required environment variables for SaaS template
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('validation failed');
      expect(result.code).toBe('CREATE_PROJECT_FAILED');
    });

    it('should use default values for optional parameters', async () => {
      const result = await handleCreateProjectFromTemplate({
        templateId: 'nextjs-landing-page',
        projectName: 'my-landing-page',
        projectPath: '/Users/test/my-landing-page',
        projectId: 'test-project-123'
        // Should use defaults: roleId='developer', selectedRoles=['developer'], variables={}
      });
      
      expect(result.success).toBe(true);
      expect(result.installation.roleAssignments).toEqual(['developer']);
    });
  });

  describe('handleSearchTemplates', () => {
    it('should search templates with multiple criteria', async () => {
      const result = await handleSearchTemplates({
        framework: 'next.js',
        tags: ['saas']
      });
      
      expect(result.success).toBe(true);
      expect(result.templates).toBeDefined();
      expect(result.count).toBeGreaterThan(0);
      expect(result.criteria).toEqual({
        framework: 'next.js',
        tags: ['saas']
      });
      
      // Check match reasons
      result.templates.forEach((template: any) => {
        expect(template.matchReasons).toBeDefined();
        expect(template.matchReasons.length).toBeGreaterThan(0);
      });
    });

    it('should handle empty search results', async () => {
      const result = await handleSearchTemplates({
        category: 'nonexistent'
      });
      
      expect(result.success).toBe(true);
      expect(result.templates).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });

  describe('handleGetTemplateDeploymentConfig', () => {
    it('should get deployment config for template', async () => {
      const result = await handleGetTemplateDeploymentConfig({
        templateId: 'nextjs-saas-starter'
      });
      
      expect(result.success).toBe(true);
      expect(result.deploymentConfig).toBeDefined();
      expect(result.deploymentConfig.supportedPlatforms).toContain('vercel');
      expect(result.deploymentConfig.preferredPlatform).toBe('vercel');
      expect(result.dependencies).toBeDefined();
      expect(result.environmentVars).toBeDefined();
    });

    it('should handle non-existent template', async () => {
      const result = await handleGetTemplateDeploymentConfig({
        templateId: 'non-existent'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(result.code).toBe('GET_DEPLOYMENT_CONFIG_FAILED');
    });
  });
});

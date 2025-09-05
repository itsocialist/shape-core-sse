/**
 * Test suite for Template Registry and Template System
 * Defines expected behavior for application template management
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { 
  Template, 
  TemplateConfig, 
  ProjectTemplate,
  TemplateInstallation,
  RoleWorkflow
} from '../types.js';
import { TemplateRegistry } from '../TemplateRegistry.js';

describe('Template System', () => {
  let registry: TemplateRegistry;

  beforeEach(() => {
    // Use clean registry without built-in templates for testing
    registry = new TemplateRegistry();
  });

  describe('Template Registration', () => {
    it('should register a template with metadata and workflows', () => {
      const template: Template = {
        id: 'nextjs-saas-starter',
        name: 'Next.js SaaS Starter',
        description: 'Full-stack SaaS application with authentication and payments',
        version: '1.0.0',
        author: 'MPCM Team',
        category: 'saas',
        tags: ['nextjs', 'typescript', 'saas', 'stripe', 'auth'],
        framework: 'next.js',
        
        dependencies: ['stripe-integration', 'auth0-setup'],
        environmentVars: {
          required: ['DATABASE_URL', 'NEXTAUTH_SECRET'],
          optional: ['STRIPE_SECRET_KEY', 'AUTH0_SECRET']
        },
        
        deploymentConfig: {
          supportedPlatforms: ['vercel', 'netlify'],
          preferredPlatform: 'vercel',
          buildCommand: 'npm run build',
          environmentTypes: ['preview', 'production']
        },
        
        roleWorkflows: {
          architect: {
            steps: ['review_requirements', 'design_architecture'],
            outputs: ['architecture_doc', 'tech_stack_decisions']
          },
          developer: {
            steps: ['setup_project', 'implement_features', 'write_tests'],
            outputs: ['source_code', 'test_suite']
          },
          devops: {
            steps: ['configure_deployment', 'setup_monitoring'],
            outputs: ['deployment_config', 'monitoring_setup']
          }
        },
        
        files: [
          {
            path: 'package.json',
            type: 'json',
            template: true
          },
          {
            path: 'src/app/layout.tsx',
            type: 'tsx',
            template: true
          }
        ]
      };

      registry.register(template);
      
      const retrieved = registry.getTemplate('nextjs-saas-starter');
      expect(retrieved).toEqual(template);
    });

    it('should list templates by category', () => {
      const saasTemplate: Template = {
        id: 'saas-1',
        name: 'SaaS Template',
        description: 'SaaS app',
        version: '1.0.0',
        author: 'Test',
        category: 'saas',
        tags: [],
        framework: 'next.js',
        dependencies: [],
        environmentVars: { required: [], optional: [] },
        deploymentConfig: {
          supportedPlatforms: ['vercel'],
          preferredPlatform: 'vercel',
          buildCommand: 'npm run build',
          environmentTypes: ['production']
        },
        roleWorkflows: {},
        files: []
      };

      const landingTemplate: Template = {
        ...saasTemplate,
        id: 'landing-1',
        name: 'Landing Page',
        category: 'landing'
      };

      registry.register(saasTemplate);
      registry.register(landingTemplate);

      const saasTemplates = registry.listByCategory('saas');
      expect(saasTemplates).toHaveLength(1);
      expect(saasTemplates[0].id).toBe('saas-1');

      const landingTemplates = registry.listByCategory('landing');
      expect(landingTemplates).toHaveLength(1);
      expect(landingTemplates[0].id).toBe('landing-1');
    });

    it('should search templates by framework and tags', () => {
      const nextjsTemplate: Template = {
        id: 'nextjs-app',
        name: 'Next.js App',
        description: 'Next.js application',
        version: '1.0.0',
        author: 'Test',
        category: 'web',
        tags: ['nextjs', 'typescript'],
        framework: 'next.js',
        dependencies: [],
        environmentVars: { required: [], optional: [] },
        deploymentConfig: {
          supportedPlatforms: ['vercel'],
          preferredPlatform: 'vercel',
          buildCommand: 'npm run build',
          environmentTypes: ['production']
        },
        roleWorkflows: {},
        files: []
      };

      registry.register(nextjsTemplate);

      const nextjsResults = registry.searchByFramework('next.js');
      expect(nextjsResults).toHaveLength(1);

      const typescriptResults = registry.searchByTags(['typescript']);
      expect(typescriptResults).toHaveLength(1);
    });
  });

  describe('Template Installation', () => {
    it('should create a new project from template', async () => {
      const template: Template = {
        id: 'simple-nextjs',
        name: 'Simple Next.js',
        description: 'Basic Next.js app',
        version: '1.0.0',
        author: 'Test',
        category: 'web',
        tags: ['nextjs'],
        framework: 'next.js',
        dependencies: [],
        environmentVars: { required: [], optional: [] },
        deploymentConfig: {
          supportedPlatforms: ['vercel'],
          preferredPlatform: 'vercel',
          buildCommand: 'npm run build',
          environmentTypes: ['production']
        },
        roleWorkflows: {},
        files: [
          {
            path: 'package.json',
            type: 'json',
            template: true,
            content: '{"name": "{{projectName}}", "version": "1.0.0"}'
          }
        ]
      };

      registry.register(template);

      const config: TemplateConfig = {
        templateId: 'simple-nextjs',
        projectName: 'my-awesome-app',
        projectPath: '/Users/test/my-awesome-app',
        variables: {
          projectName: 'my-awesome-app',
          description: 'My awesome application'
        },
        selectedRoles: ['developer', 'devops']
      };

      const installation = await registry.createProject(config);
      
      expect(installation).toEqual({
        projectPath: '/Users/test/my-awesome-app',
        templateId: 'simple-nextjs',
        createdFiles: ['package.json'],
        roleAssignments: ['developer', 'devops'],
        nextSteps: expect.any(Array),
        deploymentReady: true
      });
    });

    it('should validate template configuration before installation', async () => {
      const template: Template = {
        id: 'validated-template',
        name: 'Validated Template',
        description: 'Template with validation',
        version: '1.0.0',
        author: 'Test',
        category: 'web',
        tags: [],
        framework: 'next.js',
        dependencies: ['stripe-integration'],
        environmentVars: { 
          required: ['DATABASE_URL', 'STRIPE_SECRET_KEY'], 
          optional: [] 
        },
        deploymentConfig: {
          supportedPlatforms: ['vercel'],
          preferredPlatform: 'vercel',
          buildCommand: 'npm run build',
          environmentTypes: ['production']
        },
        roleWorkflows: {},
        files: []
      };

      registry.register(template);

      const validConfig: TemplateConfig = {
        templateId: 'validated-template',
        projectName: 'valid-project',
        projectPath: '/Users/test/valid-project',
        variables: {},
        selectedRoles: ['developer'],
        environmentVars: {
          DATABASE_URL: 'postgres://localhost/mydb',
          STRIPE_SECRET_KEY: 'sk_test_...'
        }
      };

      const validation = await registry.validateConfig(validConfig);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      const invalidConfig: TemplateConfig = {
        ...validConfig,
        environmentVars: {} // Missing required vars
      };

      const invalidValidation = await registry.validateConfig(invalidConfig);
      expect(invalidValidation.valid).toBe(false);
      expect(invalidValidation.errors).toContain('Missing required environment variable: DATABASE_URL');
    });
  });

  describe('Role Workflow Integration', () => {
    it('should generate role-specific next steps', async () => {
      const template: Template = {
        id: 'workflow-template',
        name: 'Workflow Template',
        description: 'Template with role workflows',
        version: '1.0.0',
        author: 'Test',
        category: 'web',
        tags: [],
        framework: 'next.js',
        dependencies: [],
        environmentVars: { required: [], optional: [] },
        deploymentConfig: {
          supportedPlatforms: ['vercel'],
          preferredPlatform: 'vercel',
          buildCommand: 'npm run build',
          environmentTypes: ['production']
        },
        roleWorkflows: {
          developer: {
            steps: [
              'setup_development_environment',
              'implement_core_features',
              'write_unit_tests'
            ],
            outputs: ['src/', 'tests/']
          },
          devops: {
            steps: [
              'configure_ci_cd',
              'setup_production_deployment',
              'configure_monitoring'
            ],
            outputs: ['.github/workflows/', 'docker-compose.yml']
          }
        },
        files: []
      };

      registry.register(template);

      const config: TemplateConfig = {
        templateId: 'workflow-template',
        projectName: 'workflow-project',
        projectPath: '/Users/test/workflow-project',
        variables: {},
        selectedRoles: ['developer', 'devops']
      };

      const installation = await registry.createProject(config);
      
      expect(installation.nextSteps).toEqual([
        {
          role: 'developer',
          steps: [
            'setup_development_environment',
            'implement_core_features',
            'write_unit_tests'
          ]
        },
        {
          role: 'devops',
          steps: [
            'configure_ci_cd',
            'setup_production_deployment',
            'configure_monitoring'
          ]
        }
      ]);
    });
  });
});

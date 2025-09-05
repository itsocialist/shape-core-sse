/**
 * Tests for built-in templates and factory
 */

import { describe, it, expect } from '@jest/globals';
import { createTemplateRegistry } from '../factory.js';
import { TEMPLATE_CATEGORIES, TEMPLATE_FRAMEWORKS } from '../types.js';

describe('Built-in Templates', () => {
  let registry: ReturnType<typeof createTemplateRegistry>;

  beforeEach(() => {
    registry = createTemplateRegistry();
  });

  it('should include Next.js SaaS starter template', () => {
    const template = registry.getTemplate('nextjs-saas-starter');
    
    expect(template).toBeDefined();
    expect(template!.name).toBe('Next.js SaaS Starter');
    expect(template!.category).toBe(TEMPLATE_CATEGORIES.SAAS);
    expect(template!.framework).toBe(TEMPLATE_FRAMEWORKS.NEXTJS);
    expect(template!.tags).toContain('saas');
    expect(template!.tags).toContain('nextjs');
    expect(template!.dependencies).toContain('stripe-integration');
  });

  it('should include Next.js landing page template', () => {
    const template = registry.getTemplate('nextjs-landing-page');
    
    expect(template).toBeDefined();
    expect(template!.name).toBe('Next.js Landing Page');
    expect(template!.category).toBe(TEMPLATE_CATEGORIES.LANDING);
    expect(template!.framework).toBe(TEMPLATE_FRAMEWORKS.NEXTJS);
    expect(template!.tags).toContain('landing');
    expect(template!.tags).toContain('nextjs');
  });

  it('should have correct role workflows for SaaS template', () => {
    const template = registry.getTemplate('nextjs-saas-starter');
    
    expect(template!.roleWorkflows.architect).toBeDefined();
    expect(template!.roleWorkflows.developer).toBeDefined();
    expect(template!.roleWorkflows.devops).toBeDefined();
    
    // Check architect workflow
    expect(template!.roleWorkflows.architect.steps).toContain('review_saas_requirements');
    expect(template!.roleWorkflows.architect.outputs).toContain('architecture_doc');
    
    // Check developer workflow
    expect(template!.roleWorkflows.developer.steps).toContain('implement_authentication');
    expect(template!.roleWorkflows.developer.outputs).toContain('src/');
    
    // Check devops workflow
    expect(template!.roleWorkflows.devops.steps).toContain('configure_vercel_deployment');
    expect(template!.roleWorkflows.devops.outputs).toContain('vercel.json');
  });

  it('should have template files with variable placeholders', () => {
    const template = registry.getTemplate('nextjs-saas-starter');
    
    const packageJsonFile = template!.files.find(f => f.path === 'package.json');
    expect(packageJsonFile).toBeDefined();
    expect(packageJsonFile!.template).toBe(true);
    expect(packageJsonFile!.content).toContain('{{projectName}}');
    
    const layoutFile = template!.files.find(f => f.path === 'src/app/layout.tsx');
    expect(layoutFile).toBeDefined();
    expect(layoutFile!.template).toBe(true);
    expect(layoutFile!.content).toContain('{{projectName}}');
  });

  it('should support deployment configuration', () => {
    const template = registry.getTemplate('nextjs-saas-starter');
    
    expect(template!.deploymentConfig.supportedPlatforms).toContain('vercel');
    expect(template!.deploymentConfig.preferredPlatform).toBe('vercel');
    expect(template!.deploymentConfig.buildCommand).toBe('npm run build');
    expect(template!.deploymentConfig.environmentTypes).toContain('production');
  });

  it('should define required environment variables', () => {
    const template = registry.getTemplate('nextjs-saas-starter');
    
    expect(template!.environmentVars.required).toContain('DATABASE_URL');
    expect(template!.environmentVars.required).toContain('NEXTAUTH_SECRET');
    expect(template!.environmentVars.required).toContain('STRIPE_SECRET_KEY');
    
    expect(template!.environmentVars.optional).toContain('ANALYTICS_ID');
  });

  it('should list templates by category', () => {
    const saasTemplates = registry.listByCategory('saas');
    const landingTemplates = registry.listByCategory('landing');
    
    expect(saasTemplates).toHaveLength(1);
    expect(saasTemplates[0].id).toBe('nextjs-saas-starter');
    
    expect(landingTemplates).toHaveLength(1);
    expect(landingTemplates[0].id).toBe('nextjs-landing-page');
  });

  it('should search templates by framework', () => {
    const nextjsTemplates = registry.searchByFramework('next.js');
    
    expect(nextjsTemplates).toHaveLength(2);
    expect(nextjsTemplates.map(t => t.id)).toContain('nextjs-saas-starter');
    expect(nextjsTemplates.map(t => t.id)).toContain('nextjs-landing-page');
  });

  it('should search templates by tags', () => {
    const saasTemplates = registry.searchByTags(['saas']);
    const marketingTemplates = registry.searchByTags(['marketing']);
    
    expect(saasTemplates).toHaveLength(1);
    expect(saasTemplates[0].id).toBe('nextjs-saas-starter');
    
    expect(marketingTemplates).toHaveLength(1);
    expect(marketingTemplates[0].id).toBe('nextjs-landing-page');
  });
});

describe('Template Factory', () => {
  it('should create registry with built-in templates', () => {
    const registry = createTemplateRegistry();
    
    const allTemplates = registry.listAll();
    expect(allTemplates.length).toBeGreaterThanOrEqual(2);
    
    const templateIds = allTemplates.map(t => t.id);
    expect(templateIds).toContain('nextjs-saas-starter');
    expect(templateIds).toContain('nextjs-landing-page');
  });
});

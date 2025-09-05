/**
 * Test suite for DeploymentProvider interface and pluggable deployment system
 * Tests define the expected behavior for all deployment providers
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DeploymentProvider, DeploymentConfig, DeploymentResult, DeploymentStatus } from '../types.js';
import { DeploymentRegistry } from '../DeploymentRegistry.js';
import { RoleContext } from '../../types/roles.js';

// Test implementation that doesn't require file system
class TestVercelProvider implements DeploymentProvider {
  getCapabilities() {
    return {
      platform: 'vercel',
      supportedFrameworks: ['next.js', 'react', 'vue', 'svelte', 'static'],
      features: ['serverless', 'edge-functions', 'static-sites', 'previews'],
      environmentTypes: ['preview', 'production'],
      maxDeploymentSize: '100MB'
    };
  }

  async validate(config: DeploymentConfig): Promise<void> {
    if (config.projectPath === '/invalid/path') {
      throw new Error('Project path does not exist');
    }
  }

  async resolveDependencies(config: DeploymentConfig) {
    const knownDeps = ['stripe-integration', 'auth0-setup', 'stripe', 'auth'];
    const resolved = config.dependencies.filter(dep => knownDeps.includes(dep));
    const missing = config.dependencies.filter(dep => !knownDeps.includes(dep));
    
    const environmentVars: Record<string, string> = {};
    
    if (resolved.includes('stripe-integration')) {
      environmentVars.STRIPE_SECRET_KEY = 'required';
      environmentVars.STRIPE_PUBLISHABLE_KEY = 'required';
    }
    
    if (resolved.includes('auth0-setup')) {
      environmentVars.AUTH0_DOMAIN = 'required';
      environmentVars.AUTH0_CLIENT_ID = 'required';
      environmentVars.AUTH0_CLIENT_SECRET = 'required';
    }

    return {
      resolved,
      missing,
      conflicts: [],
      environmentVars
    };
  }

  async prepare(config: DeploymentConfig, roleContext: RoleContext) {
    return {
      configFiles: ['.vercel/project.json'],
      environmentVariables: {
        NODE_ENV: 'production',
        VERCEL: '1'
      },
      buildCommand: 'npm run build',
      deploymentId: 'deploy-12345'
    };
  }

  async enhanceWithRoleContext(config: DeploymentConfig, roleContext: RoleContext) {
    const enhanced = { ...config };
    
    if (roleContext.role === 'devops') {
      (enhanced as any).securityHeaders = {
        'Strict-Transport-Security': 'max-age=31536000'
      };
      (enhanced as any).monitoring = {
        enabled: true,
        alerts: ['deployment-failure', 'performance-degradation']
      };
    }
    
    return enhanced;
  }

  async deploy(config: DeploymentConfig, roleContext: RoleContext): Promise<DeploymentResult> {
    await this.validate(config);
    
    const deps = await this.resolveDependencies(config);
    if (deps.missing.length > 0) {
      throw new Error(`Cannot resolve dependency: ${deps.missing[0]}`);
    }

    return {
      deploymentId: 'vercel_abc123',
      status: DeploymentStatus.PENDING,
      url: null,
      platform: 'vercel',
      environment: config.environment,
      createdAt: new Date(),
      logs: [
        {
          timestamp: new Date(),
          level: 'info',
          message: 'Deployment initiated'
        }
      ]
    };
  }

  async getStatus(deploymentId: string) {
    return {
      deploymentId,
      status: DeploymentStatus.READY,
      url: `https://${deploymentId}.vercel.app`,
      lastUpdated: new Date(),
      buildLogs: [
        {
          timestamp: new Date(),
          level: 'info',
          message: 'Build started'
        }
      ]
    };
  }

  async cancel(deploymentId: string): Promise<void> {
    // Test implementation
  }
}

describe('DeploymentProvider Interface', () => {
  let provider: DeploymentProvider;
  let mockRoleContext: RoleContext;

  beforeEach(() => {
    provider = new TestVercelProvider();
    
    mockRoleContext = {
      role: 'devops',
      projectId: 'test-project',
      context: {
        deploymentTarget: 'vercel',
        framework: 'next.js',
        environmentVars: {}
      }
    };
  });

  describe('Provider Contract', () => {
    it('should validate deployment configuration before deploying', async () => {
      const invalidConfig: DeploymentConfig = {
        projectPath: '/invalid/path',
        platform: 'vercel',
        environment: 'production',
        dependencies: []
      };

      await expect(provider.validate(invalidConfig))
        .rejects.toThrow('Project path does not exist');
    });

    it('should return deployment capabilities for provider selection', () => {
      const capabilities = provider.getCapabilities();
      
      expect(capabilities).toEqual({
        platform: 'vercel',
        supportedFrameworks: ['next.js', 'react', 'vue', 'svelte', 'static'],
        features: ['serverless', 'edge-functions', 'static-sites', 'previews'],
        environmentTypes: ['preview', 'production'],
        maxDeploymentSize: '100MB'
      });
    });

    it('should prepare deployment with role-specific context', async () => {
      const config: DeploymentConfig = {
        projectPath: '/Users/test/my-app',
        platform: 'vercel',
        environment: 'production',
        dependencies: ['stripe', 'auth']
      };

      const prepared = await provider.prepare(config, mockRoleContext);
      
      expect(prepared).toEqual({
        configFiles: ['.vercel/project.json'],
        environmentVariables: expect.objectContaining({
          NODE_ENV: 'production'
        }),
        buildCommand: 'npm run build',
        deploymentId: expect.stringMatching(/^deploy-/)
      });
    });

    it('should deploy and return trackable deployment result', async () => {
      const config: DeploymentConfig = {
        projectPath: '/Users/test/my-app',
        platform: 'vercel',
        environment: 'production',
        dependencies: []
      };

      const result = await provider.deploy(config, mockRoleContext);
      
      expect(result).toEqual({
        deploymentId: expect.stringMatching(/^vercel_/),
        status: DeploymentStatus.PENDING,
        url: null,
        platform: 'vercel',
        environment: 'production',
        createdAt: expect.any(Date),
        logs: expect.arrayContaining([
          expect.objectContaining({
            level: 'info',
            message: 'Deployment initiated'
          })
        ])
      });
    });

    it('should monitor deployment progress', async () => {
      const deploymentId = 'vercel_abc123';
      
      const status = await provider.getStatus(deploymentId);
      
      expect(status).toEqual({
        deploymentId,
        status: expect.any(String),
        url: expect.any(String),
        lastUpdated: expect.any(Date),
        buildLogs: expect.any(Array)
      });
    });
  });

  describe('Template Dependency System', () => {
    it('should resolve template dependencies before deployment', async () => {
      const config: DeploymentConfig = {
        projectPath: '/Users/test/my-app',
        platform: 'vercel',
        environment: 'production',
        dependencies: ['stripe-integration', 'auth0-setup']
      };

      const resolved = await provider.resolveDependencies(config);
      
      expect(resolved).toEqual({
        resolved: ['stripe-integration', 'auth0-setup'],
        missing: [],
        conflicts: [],
        environmentVars: {
          STRIPE_SECRET_KEY: 'required',
          STRIPE_PUBLISHABLE_KEY: 'required',
          AUTH0_DOMAIN: 'required',
          AUTH0_CLIENT_ID: 'required',
          AUTH0_CLIENT_SECRET: 'required'
        }
      });
    });

    it('should fail deployment when dependencies cannot be resolved', async () => {
      const config: DeploymentConfig = {
        projectPath: '/Users/test/my-app',
        platform: 'vercel',
        environment: 'production',
        dependencies: ['nonexistent-integration']
      };

      // Test dependency resolution separately first
      const resolved = await provider.resolveDependencies(config);
      expect(resolved.missing).toContain('nonexistent-integration');

      // Test that deployment fails with unresolved dependencies
      await expect(provider.deploy(config, mockRoleContext))
        .rejects.toThrow('Cannot resolve dependency: nonexistent-integration');
    });
  });

  describe('Role Integration', () => {
    it('should enhance deployment with role-specific context', async () => {
      const devOpsContext: RoleContext = {
        role: 'devops',
        projectId: 'test-project',
        context: {
          preferredEnvironment: 'production',
          securitySettings: { enableHttps: true },
          monitoringEnabled: true
        }
      };

      const config: DeploymentConfig = {
        projectPath: '/Users/test/my-app',
        platform: 'vercel',
        environment: 'production',
        dependencies: []
      };

      const enhanced = await provider.enhanceWithRoleContext(config, devOpsContext);
      
      expect(enhanced).toEqual({
        ...config,
        securityHeaders: expect.objectContaining({
          'Strict-Transport-Security': 'max-age=31536000'
        }),
        monitoring: {
          enabled: true,
          alerts: ['deployment-failure', 'performance-degradation']
        }
      });
    });
  });
});

describe('DeploymentRegistry', () => {
  let registry: DeploymentRegistry;

  beforeEach(() => {
    registry = new DeploymentRegistry();
  });

  it('should register deployment providers', () => {
    const vercelProvider = new TestVercelProvider();
    
    registry.register('vercel', vercelProvider);
    
    const provider = registry.getProvider('vercel');
    expect(provider).toBe(vercelProvider);
  });

  it('should select best provider for deployment config', () => {
    const vercelProvider = new TestVercelProvider();
    registry.register('vercel', vercelProvider);
    
    const config: DeploymentConfig = {
      projectPath: '/Users/test/next-app',
      platform: 'auto',
      environment: 'production',
      dependencies: []
    };

    const selected = registry.selectProvider(config);
    
    expect(selected.platform).toBe('vercel');
  });

  it('should throw error when no suitable provider found', () => {
    const config: DeploymentConfig = {
      projectPath: '/Users/test/unsupported-app',
      platform: 'unsupported',
      environment: 'production',
      dependencies: []
    };

    expect(() => registry.selectProvider(config))
      .toThrow('No deployment provider found for platform: unsupported');
  });
});

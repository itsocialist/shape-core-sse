/**
 * Base abstract class for deployment providers
 * Provides common functionality and enforces interface compliance
 */

import { 
  DeploymentProvider,
  DeploymentConfig,
  DeploymentCapabilities,
  DependencyResolution,
  DeploymentPreparation,
  DeploymentResult,
  DeploymentStatusResponse,
  EnhancedDeploymentConfig,
  DeploymentStatus,
  DeploymentLog
} from '../types.js';
import { RoleContext } from '../../types/roles.js';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export abstract class BaseDeploymentProvider implements DeploymentProvider {
  protected abstract platformName: string;

  abstract getCapabilities(): DeploymentCapabilities;
  abstract executeDeployment(config: DeploymentConfig, roleContext: RoleContext): Promise<DeploymentResult>;
  abstract checkDeploymentStatus(deploymentId: string): Promise<DeploymentStatusResponse>;

  /**
   * Validate deployment configuration
   */
  async validate(config: DeploymentConfig): Promise<void> {
    // Check if project path exists
    try {
      await fs.access(config.projectPath);
    } catch {
      throw new Error('Project path does not exist');
    }

    // Validate platform compatibility
    const capabilities = this.getCapabilities();
    if (config.platform !== 'auto' && config.platform !== capabilities.platform) {
      throw new Error(`Platform mismatch: expected ${capabilities.platform}, got ${config.platform}`);
    }

    // Validate environment
    if (!capabilities.environmentTypes.includes(config.environment)) {
      throw new Error(`Unsupported environment: ${config.environment}`);
    }

    // Additional validation
    await this.validateProjectStructure(config);
  }

  /**
   * Resolve template dependencies
   */
  async resolveDependencies(config: DeploymentConfig): Promise<DependencyResolution> {
    const resolved: string[] = [];
    const missing: string[] = [];
    const conflicts: string[] = [];
    const environmentVars: Record<string, string> = {};

    for (const dependency of config.dependencies) {
      const resolution = await this.resolveDependency(dependency);
      
      if (resolution.resolved) {
        resolved.push(dependency);
        Object.assign(environmentVars, resolution.environmentVars);
      } else {
        missing.push(dependency);
      }
    }

    return {
      resolved,
      missing,
      conflicts,
      environmentVars
    };
  }

  /**
   * Prepare deployment with role-specific context
   */
  async prepare(config: DeploymentConfig, roleContext: RoleContext): Promise<DeploymentPreparation> {
    // Generate unique deployment ID
    const deploymentId = this.generateDeploymentId();

    // Create basic preparation
    const preparation: DeploymentPreparation = {
      configFiles: await this.generateConfigFiles(config, roleContext),
      environmentVariables: await this.generateEnvironmentVariables(config, roleContext),
      buildCommand: await this.determineBuildCommand(config),
      deploymentId
    };

    return preparation;
  }

  /**
   * Enhance configuration with role-specific context
   */
  async enhanceWithRoleContext(
    config: DeploymentConfig,
    roleContext: RoleContext
  ): Promise<EnhancedDeploymentConfig> {
    const enhanced: EnhancedDeploymentConfig = { ...config };

    // Apply role-specific enhancements
    if (roleContext.role === 'devops') {
      enhanced.securityHeaders = this.getSecurityHeaders(roleContext);
      enhanced.monitoring = this.getMonitoringConfig(roleContext);
    }

    if (roleContext.role === 'product') {
      enhanced.analytics = this.getAnalyticsConfig(roleContext);
    }

    return enhanced;
  }

  /**
   * Execute deployment (template method)
   */
  async deploy(config: DeploymentConfig, roleContext: RoleContext): Promise<DeploymentResult> {
    // Validate first
    await this.validate(config);

    // Resolve dependencies
    const dependencies = await this.resolveDependencies(config);
    if (dependencies.missing.length > 0) {
      throw new Error(`Cannot resolve dependency: ${dependencies.missing[0]}`);
    }

    // Prepare deployment
    const preparation = await this.prepare(config, roleContext);

    // Execute platform-specific deployment
    const result = await this.executeDeployment(config, roleContext);

    // Log deployment initiation
    result.logs.push({
      timestamp: new Date(),
      level: 'info',
      message: 'Deployment initiated',
      source: this.platformName
    });

    return result;
  }

  /**
   * Get deployment status
   */
  async getStatus(deploymentId: string): Promise<DeploymentStatusResponse> {
    return await this.checkDeploymentStatus(deploymentId);
  }

  /**
   * Cancel deployment (default implementation)
   */
  async cancel(deploymentId: string): Promise<void> {
    throw new Error('Deployment cancellation not supported by this provider');
  }

  // Protected helper methods
  protected generateDeploymentId(): string {
    const prefix = this.platformName.toLowerCase();
    const suffix = crypto.randomBytes(8).toString('hex');
    return `deploy-${prefix}-${suffix}`;
  }

  protected async validateProjectStructure(config: DeploymentConfig): Promise<void> {
    // Override in subclasses for platform-specific validation
  }

  protected async resolveDependency(dependency: string): Promise<{
    resolved: boolean;
    environmentVars: Record<string, string>;
  }> {
    // Mock dependency resolution for known dependencies
    const knownDependencies: Record<string, Record<string, string>> = {
      'stripe-integration': {
        STRIPE_SECRET_KEY: 'required',
        STRIPE_PUBLISHABLE_KEY: 'required'
      },
      'auth0-setup': {
        AUTH0_DOMAIN: 'required',
        AUTH0_CLIENT_ID: 'required',
        AUTH0_CLIENT_SECRET: 'required'
      },
      'stripe': {
        STRIPE_SECRET_KEY: 'required'
      },
      'auth': {
        AUTH_SECRET: 'required'
      }
    };

    const envVars = knownDependencies[dependency];
    return {
      resolved: !!envVars,
      environmentVars: envVars || {}
    };
  }

  protected async generateConfigFiles(
    config: DeploymentConfig, 
    roleContext: RoleContext
  ): Promise<string[]> {
    // Override in subclasses
    return [];
  }

  protected async generateEnvironmentVariables(
    config: DeploymentConfig,
    roleContext: RoleContext
  ): Promise<Record<string, string>> {
    return {
      NODE_ENV: config.environment === 'production' ? 'production' : 'development',
      DEPLOYMENT_PLATFORM: this.platformName
    };
  }

  protected async determineBuildCommand(config: DeploymentConfig): Promise<string> {
    // Try to detect from package.json
    try {
      const packageJsonPath = path.join(config.projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      if (packageJson.scripts?.build) {
        return 'npm run build';
      }
    } catch {
      // Fallback to default
    }

    return 'npm run build';
  }

  protected getSecurityHeaders(roleContext: RoleContext): Record<string, string> {
    return {
      'Strict-Transport-Security': 'max-age=31536000',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    };
  }

  protected getMonitoringConfig(roleContext: RoleContext): {
    enabled: boolean;
    alerts: string[];
  } {
    return {
      enabled: true,
      alerts: ['deployment-failure', 'performance-degradation']
    };
  }

  protected getAnalyticsConfig(roleContext: RoleContext): {
    provider: string;
    config: Record<string, any>;
  } {
    return {
      provider: 'vercel-analytics',
      config: {
        enabled: true
      }
    };
  }

  protected createLog(level: 'info' | 'warn' | 'error', message: string): DeploymentLog {
    return {
      timestamp: new Date(),
      level,
      message,
      source: this.platformName
    };
  }
}

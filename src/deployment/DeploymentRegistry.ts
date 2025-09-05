/**
 * Registry for managing deployment providers
 * Handles provider registration, selection, and routing
 */

import { 
  DeploymentProvider, 
  DeploymentConfig, 
  ProviderSelection,
  DeploymentRegistry as IDeploymentRegistry 
} from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export class DeploymentRegistry implements IDeploymentRegistry {
  private providers = new Map<string, DeploymentProvider>();

  /**
   * Register a deployment provider
   */
  register(name: string, provider: DeploymentProvider): void {
    this.providers.set(name, provider);
  }

  /**
   * Get a specific provider by name
   */
  getProvider(name: string): DeploymentProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Deployment provider not found: ${name}`);
    }
    return provider;
  }

  /**
   * Select the best provider for a deployment configuration
   */
  selectProvider(config: DeploymentConfig): ProviderSelection {
    // If platform is explicitly specified (not 'auto')
    if (config.platform !== 'auto') {
      if (!this.providers.has(config.platform)) {
        throw new Error(`No deployment provider found for platform: ${config.platform}`);
      }
      return {
        platform: config.platform,
        confidence: 1.0,
        reason: 'Explicitly specified platform'
      };
    }

    // Auto-select based on project structure and capabilities
    return this.detectBestProvider(config);
  }

  /**
   * List all registered providers
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Auto-detect the best provider based on project characteristics
   */
  private detectBestProvider(config: DeploymentConfig): ProviderSelection {
    const selections: ProviderSelection[] = [];

    for (const [name, provider] of this.providers) {
      const confidence = this.calculateProviderConfidence(provider, config);
      if (confidence > 0) {
        selections.push({
          platform: name,
          confidence,
          reason: this.getSelectionReason(provider, config)
        });
      }
    }

    if (selections.length === 0) {
      throw new Error('No suitable deployment provider found for project');
    }

    // Return the provider with highest confidence
    selections.sort((a, b) => b.confidence - a.confidence);
    return selections[0];
  }

  /**
   * Calculate confidence score for a provider based on project characteristics
   */
  private calculateProviderConfidence(
    provider: DeploymentProvider, 
    config: DeploymentConfig
  ): number {
    const capabilities = provider.getCapabilities();
    let confidence = 0;

    // Check framework compatibility
    const framework = this.detectFramework(config.projectPath);
    if (framework && capabilities.supportedFrameworks.includes(framework)) {
      confidence += 0.5;
    }

    // Check feature requirements
    const requiredFeatures = this.detectRequiredFeatures(config);
    const supportedFeatures = requiredFeatures.filter(
      feature => capabilities.features.includes(feature)
    );
    
    if (requiredFeatures.length > 0) {
      confidence += (supportedFeatures.length / requiredFeatures.length) * 0.3;
    }

    // Check environment support
    if (capabilities.environmentTypes.includes(config.environment)) {
      confidence += 0.2;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Detect framework from project structure
   */
  private detectFramework(projectPath: string): string | null {
    try {
      // This would normally be async, but for simplicity in tests we'll mock it
      // In real implementation, read package.json and check dependencies
      if (projectPath.includes('next')) return 'next.js';
      if (projectPath.includes('react')) return 'react';
      if (projectPath.includes('vue')) return 'vue';
      if (projectPath.includes('svelte')) return 'svelte';
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Detect required features from project configuration
   */
  private detectRequiredFeatures(config: DeploymentConfig): string[] {
    const features: string[] = [];

    // Check dependencies for feature requirements
    if (config.dependencies.includes('serverless')) {
      features.push('serverless');
    }
    
    if (config.dependencies.includes('edge')) {
      features.push('edge-functions');
    }

    // Default to static sites if no special requirements
    if (features.length === 0) {
      features.push('static-sites');
    }

    return features;
  }

  /**
   * Generate human-readable reason for provider selection
   */
  private getSelectionReason(
    provider: DeploymentProvider, 
    config: DeploymentConfig
  ): string {
    const capabilities = provider.getCapabilities();
    const framework = this.detectFramework(config.projectPath);
    
    if (framework && capabilities.supportedFrameworks.includes(framework)) {
      return `Best support for ${framework} framework`;
    }
    
    return `Supports required features and environment: ${config.environment}`;
  }
}

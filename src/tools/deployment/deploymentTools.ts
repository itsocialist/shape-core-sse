/**
 * MCP Tool for deployment operations
 * Integrates deployment providers with role-based orchestration
 */

import { 
  DeploymentConfig, 
  DeploymentProvider, 
  DeploymentResult 
} from '../../deployment/types.js';
import { createDeploymentRegistry } from '../../deployment/factory.js';
import { getRoleContext } from '../context/roleUtils.js';

export interface DeployAppParams {
  projectPath: string;
  platform?: string;
  environment: 'preview' | 'production';
  dependencies?: string[];
  roleId?: string;
  projectId: string;
}

export interface GetDeploymentStatusParams {
  deploymentId: string;
}

export interface ListDeploymentProvidersParams {
  // Empty for now, may add filtering in future
}

/**
 * Deploy an application using configured deployment providers
 */
export async function deployApp(params: DeployAppParams): Promise<DeploymentResult> {
  const {
    projectPath,
    platform = 'auto',
    environment,
    dependencies = [],
    roleId = 'devops',
    projectId
  } = params;

  // Get deployment registry
  const registry = createDeploymentRegistry();

  // Create deployment configuration
  const config: DeploymentConfig = {
    projectPath,
    platform,
    environment,
    dependencies
  };

  // Get role context for orchestration
  const roleContext = await getRoleContext(roleId, projectId);

  // Select appropriate provider
  const selection = registry.selectProvider(config);
  const provider = registry.getProvider(selection.platform);

  // Execute deployment with role context
  const result = await provider.deploy(config, roleContext);

  return {
    ...result,
    metadata: {
      ...result.metadata,
      selectedProvider: selection.platform,
      selectionReason: selection.reason,
      confidence: selection.confidence
    }
  };
}

/**
 * Get status of a deployment
 */
export async function getDeploymentStatus(params: GetDeploymentStatusParams) {
  const { deploymentId } = params;
  
  // Extract platform from deployment ID
  const platform = deploymentId.split('_')[0];
  
  const registry = createDeploymentRegistry();
  const provider = registry.getProvider(platform);
  
  return await provider.getStatus(deploymentId);
}

/**
 * List available deployment providers and their capabilities
 */
export async function listDeploymentProviders(params: ListDeploymentProvidersParams) {
  const registry = createDeploymentRegistry();
  const providerNames = registry.listProviders();
  
  const providers = providerNames.map(name => {
    const provider = registry.getProvider(name);
    return {
      name,
      capabilities: provider.getCapabilities()
    };
  });

  return {
    providers,
    count: providers.length
  };
}

/**
 * Validate a deployment configuration
 */
export async function validateDeploymentConfig(params: DeployAppParams) {
  const {
    projectPath,
    platform = 'auto',
    environment,
    dependencies = []
  } = params;

  const registry = createDeploymentRegistry();
  
  const config: DeploymentConfig = {
    projectPath,
    platform,
    environment,
    dependencies
  };

  try {
    const selection = registry.selectProvider(config);
    const provider = registry.getProvider(selection.platform);
    
    await provider.validate(config);
    
    const dependencyResolution = await provider.resolveDependencies(config);
    
    return {
      valid: true,
      selectedProvider: selection.platform,
      selectionReason: selection.reason,
      dependencies: dependencyResolution,
      warnings: dependencyResolution.missing.length > 0 
        ? [`Missing dependencies: ${dependencyResolution.missing.join(', ')}`]
        : []
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
      selectedProvider: null
    };
  }
}

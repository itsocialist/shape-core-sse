/**
 * Factory for creating configured deployment registry
 */

import { DeploymentRegistry } from './DeploymentRegistry.js';
import { VercelProvider } from './providers/VercelProvider.js';

/**
 * Create a deployment registry with default providers
 */
export function createDeploymentRegistry(): DeploymentRegistry {
  const registry = new DeploymentRegistry();
  
  // Register default providers
  registry.register('vercel', new VercelProvider());
  
  // Future providers would be added here:
  // registry.register('netlify', new NetlifyProvider());
  // registry.register('aws', new AWSProvider());
  
  return registry;
}

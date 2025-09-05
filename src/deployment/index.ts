/**
 * Deployment module exports
 * Provides pluggable deployment provider architecture
 */

// Export types first (interfaces)
export * from './types.js';

// Export concrete implementations
export { DeploymentRegistry } from './DeploymentRegistry.js';
export * from './providers/BaseDeploymentProvider.js';
export * from './providers/VercelProvider.js';

// Convenience factory function
export { createDeploymentRegistry } from './factory.js';

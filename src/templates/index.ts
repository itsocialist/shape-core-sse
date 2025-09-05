/**
 * Template system exports
 * Complete application template system with MCP integration
 */

// Export types first
export * from './types.js';

// Export concrete implementations
export { TemplateRegistry } from './TemplateRegistry.js';
export * from './factory.js';

// Template tools
export * from '../tools/templates/templateTools.js';
export * from '../tools/templates/templateMCPTools.js';

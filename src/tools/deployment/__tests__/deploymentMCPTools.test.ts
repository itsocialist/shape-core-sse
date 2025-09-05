/**
 * Integration tests for deployment MCP tools
 * Tests the tool schemas and basic functionality
 */

import { describe, it, expect } from '@jest/globals';
import {
  deployAppTool,
  getDeploymentStatusTool,
  listDeploymentProvidersTool,
  validateDeploymentConfigTool
} from '../deploymentMCPTools.js';

describe('Deployment MCP Tool Schemas', () => {
  describe('deployAppTool', () => {
    it('should have correct tool definition', () => {
      expect(deployAppTool.name).toBe('deploy_app');
      expect(deployAppTool.description).toContain('Deploy an application');
      expect(deployAppTool.inputSchema.type).toBe('object');
      expect(deployAppTool.inputSchema.properties).toBeDefined();
      expect(deployAppTool.inputSchema.required).toEqual(['projectPath', 'environment', 'projectId']);
    });

    it('should have correct input schema properties', () => {
      const { properties } = deployAppTool.inputSchema;
      
      expect(properties.projectPath).toEqual({
        type: 'string',
        description: 'Path to the project directory to deploy'
      });

      expect(properties.environment).toEqual({
        type: 'string',
        enum: ['preview', 'production'],
        description: 'Deployment environment'
      });

      expect(properties.platform).toEqual({
        type: 'string',
        description: 'Deployment platform (vercel, netlify, aws, or auto for automatic selection)',
        default: 'auto'
      });

      expect(properties.dependencies).toEqual({
        type: 'array',
        items: { type: 'string' },
        description: 'Template dependencies to resolve (e.g., stripe-integration, auth0-setup)',
        default: []
      });

      expect(properties.roleId).toEqual({
        type: 'string',
        description: 'Role ID for context (devops, developer, architect)',
        default: 'devops'
      });

      expect(properties.projectId).toEqual({
        type: 'string',
        description: 'Project identifier for context management'
      });
    });
  });

  describe('getDeploymentStatusTool', () => {
    it('should have correct tool definition', () => {
      expect(getDeploymentStatusTool.name).toBe('get_deployment_status');
      expect(getDeploymentStatusTool.description).toContain('Get the current status');
      expect(getDeploymentStatusTool.inputSchema.required).toEqual(['deploymentId']);
    });

    it('should have correct input schema', () => {
      const { properties } = getDeploymentStatusTool.inputSchema;
      
      expect(properties.deploymentId).toEqual({
        type: 'string',
        description: 'Deployment ID returned from deploy_app'
      });
    });
  });

  describe('listDeploymentProvidersTool', () => {
    it('should have correct tool definition', () => {
      expect(listDeploymentProvidersTool.name).toBe('list_deployment_providers');
      expect(listDeploymentProvidersTool.description).toContain('List all available deployment providers');
      expect(listDeploymentProvidersTool.inputSchema.properties).toEqual({});
    });

    it('should not require any input parameters', () => {
      expect(listDeploymentProvidersTool.inputSchema.required).toBeUndefined();
    });
  });

  describe('validateDeploymentConfigTool', () => {
    it('should have correct tool definition', () => {
      expect(validateDeploymentConfigTool.name).toBe('validate_deployment_config');
      expect(validateDeploymentConfigTool.description).toContain('Validate a deployment configuration');
      expect(validateDeploymentConfigTool.inputSchema.required).toEqual(['projectPath', 'environment', 'projectId']);
    });

    it('should have similar schema structure as deploy_app', () => {
      const validateProps = validateDeploymentConfigTool.inputSchema.properties;
      const deployProps = deployAppTool.inputSchema.properties;
      
      // Check that all the same properties exist
      expect(Object.keys(validateProps)).toEqual(Object.keys(deployProps));
      
      // Check types match (descriptions may differ)
      expect(validateProps.projectPath.type).toBe(deployProps.projectPath.type);
      expect(validateProps.environment).toEqual(deployProps.environment);
      expect(validateProps.platform.type).toBe(deployProps.platform.type);
      expect(validateProps.dependencies.type).toBe(deployProps.dependencies.type);
      expect(validateProps.projectId.type).toBe(deployProps.projectId.type);
    });
  });
});

describe('Deployment Tool Integration', () => {
  it('should export all required tools', () => {
    expect(deployAppTool).toBeDefined();
    expect(getDeploymentStatusTool).toBeDefined();
    expect(listDeploymentProvidersTool).toBeDefined();
    expect(validateDeploymentConfigTool).toBeDefined();
  });

  it('should have unique tool names', () => {
    const toolNames = [
      deployAppTool.name,
      getDeploymentStatusTool.name,
      listDeploymentProvidersTool.name,
      validateDeploymentConfigTool.name
    ];

    const uniqueNames = new Set(toolNames);
    expect(uniqueNames.size).toBe(toolNames.length);
  });

  it('should all have valid MCP tool structure', () => {
    const tools = [
      deployAppTool,
      getDeploymentStatusTool,
      listDeploymentProvidersTool,
      validateDeploymentConfigTool
    ];

    for (const tool of tools) {
      expect(tool.name).toMatch(/^[a-z_]+$/); // Valid MCP tool name format
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });
});

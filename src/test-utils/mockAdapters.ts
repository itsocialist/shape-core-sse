/**
 * Mock adapters for testing MPCM-Pro
 */

import { BaseAdapter, ServiceCapability, ServiceCommand, ServiceResult } from '../adapters/base/types.js';

/**
 * Mock adapter that always succeeds
 */
export class MockSuccessAdapter implements BaseAdapter {
  private name: string;
  private capabilities: ServiceCapability[];
  
  constructor(name: string = 'mock-success') {
    this.name = name;
    this.capabilities = [
      {
        name: 'test_command',
        description: 'Test command that always succeeds',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' }
          }
        }
      }
    ];
  }
  
  getName(): string {
    return this.name;
  }
  
  getDescription(): string {
    return 'Mock adapter for testing - always succeeds';
  }
  
  async initialize(): Promise<void> {
    // Mock initialization
  }
  
  async getCapabilities(): Promise<ServiceCapability[]> {
    return this.capabilities;
  }
  
  async execute(command: ServiceCommand): Promise<ServiceResult> {
    return {
      success: true,
      data: {
        input: command.args,
        timestamp: new Date().toISOString()
      }
    };
  }
  
  async shutdown(): Promise<void> {
    // Mock shutdown
  }
}

/**
 * Mock adapter that always fails
 */
export class MockErrorAdapter implements BaseAdapter {
  private errorMessage: string;
  
  constructor(errorMessage: string = 'Mock error') {
    this.errorMessage = errorMessage;
  }
  
  getName(): string {
    return 'mock-error';
  }
  
  getDescription(): string {
    return 'Mock adapter for testing - always fails';
  }
  
  async initialize(): Promise<void> {
    throw new Error('Mock initialization error');
  }
  
  async getCapabilities(): Promise<ServiceCapability[]> {
    return [];
  }
  
  async execute(command: ServiceCommand): Promise<ServiceResult> {
    return {
      success: false,
      error: this.errorMessage
    };
  }
  
  async shutdown(): Promise<void> {
    // Mock shutdown
  }
}

/**
 * Mock adapter with configurable behavior
 */
export class MockConfigurableAdapter implements BaseAdapter {
  private config: {
    name: string;
    shouldSucceed: boolean;
    delay?: number;
    capabilities?: ServiceCapability[];
  };
  
  constructor(config: Partial<typeof MockConfigurableAdapter.prototype.config> = {}) {
    this.config = {
      name: 'mock-configurable',
      shouldSucceed: true,
      ...config
    };
  }
  
  getName(): string {
    return this.config.name;
  }
  
  getDescription(): string {
    return 'Configurable mock adapter for testing';
  }
  
  async initialize(): Promise<void> {
    if (this.config.delay) {
      await new Promise(resolve => setTimeout(resolve, this.config.delay));
    }
  }
  
  async getCapabilities(): Promise<ServiceCapability[]> {
    return this.config.capabilities || [{
      name: 'configurable_command',
      description: 'Configurable test command'
    }];
  }
  
  async execute(command: ServiceCommand): Promise<ServiceResult> {
    if (this.config.delay) {
      await new Promise(resolve => setTimeout(resolve, this.config.delay));
    }
    
    if (this.config.shouldSucceed) {
      return {
        success: true,
        data: { configured: true, ...command.args }
      };
    } else {
      return {
        success: false,
        error: 'Configured to fail'
      };
    }
  }
  
  async shutdown(): Promise<void> {
    // Mock shutdown
  }
}

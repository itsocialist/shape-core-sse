/**
 * ServiceAdapter - Base class for all service adapters
 * 
 * Provides common interface and functionality for MCP service integration
 */

import { ServiceCapability, ServiceCommand, ServiceResult } from './types.js';

export abstract class ServiceAdapter {
  /**
   * Get the unique name of this adapter
   */
  abstract getName(): string;

  /**
   * Get a human-readable description of this adapter
   */
  abstract getDescription(): string;

  /**
   * Get the capabilities provided by this adapter
   */
  abstract getCapabilities(): Promise<ServiceCapability[]>;

  /**
   * Initialize the adapter (connect to MCP service, etc.)
   */
  abstract initialize(): Promise<void>;

  /**
   * Execute a command through this adapter
   */
  abstract execute(command: ServiceCommand): Promise<ServiceResult>;

  /**
   * Clean up resources (close connections, etc.)
   */
  abstract cleanup(): Promise<void>;

  /**
   * Check if the adapter is ready to execute commands
   */
  isReady(): boolean {
    // Default implementation - can be overridden
    return true;
  }

  /**
   * Get adapter status information
   */
  async getStatus(): Promise<{ ready: boolean; message?: string }> {
    // Default implementation - can be overridden
    return {
      ready: this.isReady(),
      message: this.isReady() ? 'Adapter is ready' : 'Adapter is not ready'
    };
  }
}

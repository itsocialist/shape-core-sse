/**
 * Service Registry for MPCM-Pro
 * Central registry for all MCP service adapters
 */

import { EventEmitter } from 'events';
import { BaseAdapter, ServiceCapability, ServiceCommand, ServiceResult } from '../../adapters/base/types.js';
import { DatabaseManager } from '../../db/database.js';
import { safeJsonStringify } from '../../utils/security.js';

export interface ServiceRegistration {
  name: string;
  adapter: BaseAdapter;
  capabilities: ServiceCapability[];
  status: 'active' | 'inactive' | 'error';
  lastError?: string;
  registeredAt: Date;
}

export class ServiceRegistry extends EventEmitter {
  private services: Map<string, ServiceRegistration> = new Map();
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    super();
    this.db = db;
  }

  /**
   * Register a new service adapter
   */
  async register(adapter: BaseAdapter): Promise<void> {
    const name = adapter.getName();
    
    if (this.services.has(name)) {
      throw new Error(`Service ${name} is already registered`);
    }

    try {
      // Initialize the adapter
      await adapter.initialize();
      
      // Get capabilities
      const capabilities = await adapter.getCapabilities();
      
      // Register in memory
      this.services.set(name, {
        name,
        adapter,
        capabilities,
        status: 'active',
        registeredAt: new Date()
      });

      // Store registration in database
      await this.storeRegistration(name, capabilities);
      
      // Emit registration event
      this.emit('service:registered', { name, capabilities });
      
      console.error(`✅ Registered service: ${name} with ${capabilities.length} capabilities`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error';
      
      // Register as errored
      this.services.set(name, {
        name,
        adapter,
        capabilities: [],
        status: 'error',
        lastError: errorMsg,
        registeredAt: new Date()
      });
      
      throw new Error(`Failed to register service ${name}: ${errorMsg}`);
    }
  }

  /**
   * Execute a command on a service
   */
  async execute(serviceName: string, command: ServiceCommand): Promise<ServiceResult> {
    const service = this.services.get(serviceName);
    
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }
    
    if (service.status !== 'active') {
      throw new Error(`Service ${serviceName} is not active: ${service.lastError || 'Unknown error'}`);
    }

    try {
      // Add context from database
      const enrichedCommand = await this.enrichCommand(command);
      
      // Execute through adapter
      const result = await service.adapter.execute(enrichedCommand);
      
      // Store result in context if successful
      if (result.success) {
        await this.storeResult(serviceName, command, result);
      }
      
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error instanceof Error ? error.message : String(error) : 'Unknown error';
      
      // Update service status on error
      service.status = 'error';
      service.lastError = errorMsg;
      
      return {
        success: false,
        error: errorMsg
      };
    }
  }

  /**
   * Get all registered services
   */
  getServices(): ServiceRegistration[] {
    return Array.from(this.services.values());
  }

  /**
   * Get a specific service
   */
  getService(name: string): ServiceRegistration | undefined {
    return this.services.get(name);
  }

  /**
   * Enrich command with context from database
   */
  private async enrichCommand(command: ServiceCommand): Promise<ServiceCommand> {
    // For now, return command as-is
    // TODO: Implement context enrichment
    return command;
  }

  /**
   * Store service registration in database
   */
  private async storeRegistration(name: string, capabilities: ServiceCapability[]): Promise<void> {
    // For now, skip database storage to focus on core functionality
    // TODO: Implement proper context storage for service registry
    console.error(`Service ${name} registered (database storage pending)`);
  }

  /**
   * Store command result in context
   */
  private async storeResult(serviceName: string, command: ServiceCommand, result: ServiceResult): Promise<void> {
    if (!command.projectName || !command.storeResult) {
      return;
    }

    // For now, skip database storage to focus on core functionality
    // TODO: Implement proper result storage
    console.error(`Result stored for ${serviceName}:${command.tool}`);
  }

  /**
   * Shutdown all services
   */
  async shutdown(): Promise<void> {
    for (const [name, service] of this.services) {
      try {
        // Try shutdown first, then cleanup for compatibility
        if (typeof service.adapter.shutdown === 'function') {
          await service.adapter.shutdown();
        } else if (typeof service.adapter.cleanup === 'function') {
          await service.adapter.cleanup();
        }
        console.error(`✅ Shut down service: ${name}`);
      } catch (error) {
        console.error(`❌ Error shutting down service ${name}:`, error);
      }
    }
    
    this.services.clear();
    this.removeAllListeners();
  }
}

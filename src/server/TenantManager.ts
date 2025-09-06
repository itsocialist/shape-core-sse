/**
 * Tenant Management System
 * Manages tenant lifecycle, databases, and server instances
 */

import { join, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { DatabaseManager } from '../db/database.js';
import { MCPMProServer } from '../index.js';
import { TenantAuthenticator } from '../security/TenantAuthenticator.js';

export interface TenantConfig {
  dataPath: string;
  masterKey: string;
}

export interface TenantInstance {
  tenantId: string;
  database: DatabaseManager;
  server: MCPMProServer;
  createdAt: Date;
  lastUsed: Date;
}

export class TenantManager {
  private tenants = new Map<string, TenantInstance>();
  private authenticator: TenantAuthenticator;
  private config: TenantConfig;

  constructor(config: TenantConfig) {
    this.config = config;
    this.authenticator = new TenantAuthenticator(config.masterKey);
    
    // Ensure tenant data directory exists
    if (!existsSync(config.dataPath)) {
      mkdirSync(config.dataPath, { recursive: true });
    }
  }

  public async initialize(): Promise<void> {
    console.log('[TenantManager] Initializing tenant management system...');
    
    // In a production system, we'd load existing tenants from a master database
    // For now, we'll just ensure the development tenant is ready
    if (process.env.NODE_ENV === 'development') {
      await this.ensureDevelopmentTenant();
    }
    
    console.log('[TenantManager] Initialization complete');
  }

  private async ensureDevelopmentTenant(): Promise<void> {
    const devTenantId = 'dev-tenant-001';
    
    if (!this.tenants.has(devTenantId)) {
      try {
        await this.createTenantInstance(devTenantId);
        console.log('[TenantManager] Development tenant instance created');
      } catch (error) {
        console.error('[TenantManager] Failed to create development tenant:', error);
      }
    }
  }

  public async getTenantServer(tenantId: string): Promise<MCPMProServer | null> {
    // Check if tenant instance already exists
    let tenantInstance = this.tenants.get(tenantId);
    
    if (tenantInstance) {
      tenantInstance.lastUsed = new Date();
      return tenantInstance.server;
    }

    // Verify tenant exists in auth system
    const tenantInfo = this.authenticator.getTenantInfo(tenantId);
    if (!tenantInfo || tenantInfo.status !== 'active') {
      console.warn(`[TenantManager] Tenant ${tenantId} not found or inactive`);
      return null;
    }

    // Create new tenant instance
    try {
      tenantInstance = await this.createTenantInstance(tenantId);
      return tenantInstance.server;
    } catch (error) {
      console.error(`[TenantManager] Failed to create instance for tenant ${tenantId}:`, error);
      return null;
    }
  }

  private async createTenantInstance(tenantId: string): Promise<TenantInstance> {
    console.log(`[TenantManager] Creating instance for tenant: ${tenantId}`);
    
    // Create tenant-specific database path
    const tenantDbPath = this.getTenantDatabasePath(tenantId);
    
    // Ensure tenant directory exists
    const tenantDir = join(this.config.dataPath, tenantId);
    if (!existsSync(tenantDir)) {
      mkdirSync(tenantDir, { recursive: true });
    }

    // Create tenant database
    const database = await DatabaseManager.create(tenantDbPath);
    
    // Create tenant server instance
    const server = new MCPMProServer(database, true);
    await server.initialize();

    const instance: TenantInstance = {
      tenantId,
      database,
      server,
      createdAt: new Date(),
      lastUsed: new Date()
    };

    this.tenants.set(tenantId, instance);
    
    console.log(`[TenantManager] Instance created for tenant: ${tenantId}`);
    return instance;
  }

  private getTenantDatabasePath(tenantId: string): string {
    return resolve(join(this.config.dataPath, tenantId, 'tenant.db'));
  }

  public async createTenant(options: {
    tenantId?: string;
    permissions?: string[];
  } = {}): Promise<{
    tenantId: string;
    apiKey: string;
  }> {
    // Create tenant in auth system
    const { tenantId, apiKey } = await this.authenticator.createTenant(options);
    
    // Create tenant directory structure
    const tenantDir = join(this.config.dataPath, tenantId);
    if (!existsSync(tenantDir)) {
      mkdirSync(tenantDir, { recursive: true });
    }
    
    console.log(`[TenantManager] Created tenant: ${tenantId}`);
    
    return { tenantId, apiKey };
  }

  public async deleteTenant(tenantId: string): Promise<void> {
    // Close tenant instance if active
    const instance = this.tenants.get(tenantId);
    if (instance) {
      await instance.server.close();
      instance.database.close();
      this.tenants.delete(tenantId);
    }

    // Remove from auth system
    await this.authenticator.deleteTenant(tenantId);
    
    // Note: In a production system, you'd also want to securely delete
    // the tenant's database file and directory
    
    console.log(`[TenantManager] Deleted tenant: ${tenantId}`);
  }

  public async suspendTenant(tenantId: string): Promise<void> {
    // Close active instance
    const instance = this.tenants.get(tenantId);
    if (instance) {
      await instance.server.close();
      instance.database.close();
      this.tenants.delete(tenantId);
    }

    // Revoke in auth system
    await this.authenticator.revokeTenant(tenantId);
    
    console.log(`[TenantManager] Suspended tenant: ${tenantId}`);
  }

  public listTenants(): Array<{
    tenantId: string;
    status: string;
    createdAt: Date;
    lastUsed?: Date;
    instanceActive: boolean;
    permissions: string[];
  }> {
    const authTenants = this.authenticator.listTenants();
    
    return authTenants.map(authTenant => {
      const instance = this.tenants.get(authTenant.tenantId);
      
      return {
        tenantId: authTenant.tenantId,
        status: authTenant.status,
        createdAt: authTenant.createdAt,
        lastUsed: authTenant.lastUsed || instance?.lastUsed,
        instanceActive: !!instance,
        permissions: authTenant.permissions
      };
    });
  }

  public getActiveTenantCount(): number {
    return this.authenticator.getActiveTenantCount();
  }

  public getActiveInstanceCount(): number {
    return this.tenants.size;
  }

  public async authenticate(apiKey: string): Promise<{ tenantId: string; permissions?: string[] }> {
    return await this.authenticator.authenticate(apiKey);
  }

  public getTenantStats(tenantId: string): {
    instanceActive: boolean;
    lastUsed?: Date;
    createdAt?: Date;
    databaseSize?: number;
  } | null {
    const instance = this.tenants.get(tenantId);
    const authInfo = this.authenticator.getTenantInfo(tenantId);
    
    if (!authInfo) {
      return null;
    }

    return {
      instanceActive: !!instance,
      lastUsed: instance?.lastUsed || authInfo.lastUsed,
      createdAt: authInfo.createdAt,
      databaseSize: undefined // Could add database size calculation
    };
  }

  public async shutdown(): Promise<void> {
    console.log('[TenantManager] Shutting down tenant instances...');
    
    // Close all tenant instances
    const closePromises = Array.from(this.tenants.values()).map(async (instance) => {
      try {
        await instance.server.close();
        instance.database.close();
        console.log(`[TenantManager] Closed instance for tenant: ${instance.tenantId}`);
      } catch (error) {
        console.error(`[TenantManager] Error closing tenant ${instance.tenantId}:`, error);
      }
    });

    await Promise.all(closePromises);
    this.tenants.clear();
    
    console.log('[TenantManager] All tenant instances closed');
  }

  // Cleanup method to close inactive tenant instances
  public async cleanupInactiveInstances(maxIdleTime: number = 30 * 60 * 1000): Promise<number> {
    const now = new Date();
    let closedCount = 0;
    
    for (const [tenantId, instance] of this.tenants.entries()) {
      const idleTime = now.getTime() - instance.lastUsed.getTime();
      
      if (idleTime > maxIdleTime) {
        try {
          await instance.server.close();
          instance.database.close();
          this.tenants.delete(tenantId);
          closedCount++;
          
          console.log(`[TenantManager] Cleaned up inactive instance for tenant: ${tenantId}`);
        } catch (error) {
          console.error(`[TenantManager] Error cleaning up tenant ${tenantId}:`, error);
        }
      }
    }
    
    if (closedCount > 0) {
      console.log(`[TenantManager] Cleaned up ${closedCount} inactive instances`);
    }
    
    return closedCount;
  }
}
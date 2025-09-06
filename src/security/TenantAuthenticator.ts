/**
 * Tenant Authentication System
 * Handles API key-based authentication for multi-tenant access
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export interface TenantAuthResult {
  tenantId: string;
  permissions?: string[];
}

export interface TenantCredentials {
  tenantId: string;
  apiKeyHash: string;
  createdAt: Date;
  lastUsed?: Date;
  permissions: string[];
  status: 'active' | 'suspended' | 'deleted';
}

export class TenantAuthenticator {
  private tenantStore = new Map<string, TenantCredentials>();

  constructor(private masterKey: string) {
    // Initialize with a default tenant for development/testing
    if (process.env.NODE_ENV === 'development') {
      this.createDevelopmentTenant();
    }
  }

  private createDevelopmentTenant(): void {
    // Create a default tenant for development
    const devTenantId = 'dev-tenant-001';
    const devApiKey = 'dev-key-12345';
    
    this.tenantStore.set(devTenantId, {
      tenantId: devTenantId,
      apiKeyHash: this.hashApiKey(devApiKey),
      createdAt: new Date(),
      permissions: ['*'], // Full permissions for dev
      status: 'active'
    });

    console.log(`[Auth] Development tenant created: ${devTenantId}`);
    console.log(`[Auth] Development API key: ${devApiKey}`);
  }

  public async authenticate(apiKey: string): Promise<TenantAuthResult> {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key format');
    }

    const keyHash = this.hashApiKey(apiKey);
    
    // Find tenant by API key hash
    for (const [tenantId, credentials] of this.tenantStore.entries()) {
      if (credentials.status !== 'active') {
        continue;
      }

      // Use timing-safe comparison to prevent timing attacks
      const storedHash = Buffer.from(credentials.apiKeyHash, 'hex');
      const providedHash = Buffer.from(keyHash, 'hex');
      
      if (storedHash.length === providedHash.length && 
          timingSafeEqual(storedHash, providedHash)) {
        
        // Update last used timestamp
        credentials.lastUsed = new Date();
        
        return {
          tenantId,
          permissions: credentials.permissions
        };
      }
    }

    throw new Error('Invalid API key or inactive tenant');
  }

  public async createTenant(options: {
    tenantId?: string;
    permissions?: string[];
  } = {}): Promise<{
    tenantId: string;
    apiKey: string;
  }> {
    const tenantId = options.tenantId || this.generateTenantId();
    const apiKey = this.generateApiKey();
    
    if (this.tenantStore.has(tenantId)) {
      throw new Error(`Tenant ${tenantId} already exists`);
    }

    const credentials: TenantCredentials = {
      tenantId,
      apiKeyHash: this.hashApiKey(apiKey),
      createdAt: new Date(),
      permissions: options.permissions || ['read', 'write'],
      status: 'active'
    };

    this.tenantStore.set(tenantId, credentials);
    
    console.log(`[Auth] Created tenant: ${tenantId}`);
    
    return {
      tenantId,
      apiKey
    };
  }

  public async revokeTenant(tenantId: string): Promise<void> {
    const credentials = this.tenantStore.get(tenantId);
    if (!credentials) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    credentials.status = 'suspended';
    console.log(`[Auth] Revoked tenant: ${tenantId}`);
  }

  public async deleteTenant(tenantId: string): Promise<void> {
    if (!this.tenantStore.has(tenantId)) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    this.tenantStore.delete(tenantId);
    console.log(`[Auth] Deleted tenant: ${tenantId}`);
  }

  public getTenantInfo(tenantId: string): Omit<TenantCredentials, 'apiKeyHash'> | null {
    const credentials = this.tenantStore.get(tenantId);
    if (!credentials) {
      return null;
    }

    const { apiKeyHash, ...info } = credentials;
    return info;
  }

  public listTenants(): Array<Omit<TenantCredentials, 'apiKeyHash'>> {
    const tenants: Array<Omit<TenantCredentials, 'apiKeyHash'>> = [];
    
    for (const credentials of this.tenantStore.values()) {
      const { apiKeyHash, ...info } = credentials;
      tenants.push(info);
    }
    
    return tenants;
  }

  public getActiveTenantCount(): number {
    let count = 0;
    for (const credentials of this.tenantStore.values()) {
      if (credentials.status === 'active') {
        count++;
      }
    }
    return count;
  }

  private hashApiKey(apiKey: string): string {
    // Use HMAC with master key for additional security
    const hmac = createHash('sha256');
    hmac.update(`${this.masterKey}:${apiKey}`);
    return hmac.digest('hex');
  }

  private generateTenantId(): string {
    const timestamp = Date.now().toString(36);
    const random = randomBytes(8).toString('hex');
    return `tenant-${timestamp}-${random}`;
  }

  private generateApiKey(): string {
    // Generate a 32-byte random API key
    const keyBytes = randomBytes(32);
    return `sape_${keyBytes.toString('base64').replace(/[+/=]/g, '').substring(0, 48)}`;
  }

  public async rotateApiKey(tenantId: string): Promise<string> {
    const credentials = this.tenantStore.get(tenantId);
    if (!credentials) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const newApiKey = this.generateApiKey();
    credentials.apiKeyHash = this.hashApiKey(newApiKey);
    
    console.log(`[Auth] Rotated API key for tenant: ${tenantId}`);
    
    return newApiKey;
  }

  // For testing/development - validate a specific tenant/key combination
  public async validateDevelopmentAuth(tenantId: string, apiKey: string): Promise<boolean> {
    if (process.env.NODE_ENV !== 'development') {
      return false;
    }

    try {
      const result = await this.authenticate(apiKey);
      return result.tenantId === tenantId;
    } catch {
      return false;
    }
  }
}
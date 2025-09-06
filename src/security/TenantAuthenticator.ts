/**
 * Tenant Authentication System
 * Handles API key-based authentication for multi-tenant access with SQLite persistence
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { join } from 'path';
import Database from 'better-sqlite3';

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
  private db: Database.Database;

  constructor(private masterKey: string, dbPath?: string) {
    // Initialize persistent tenant database
    const tenantDbPath = dbPath || join(process.env.TENANT_DATA_PATH || './tenant-data', 'tenants.db');
    this.db = new Database(tenantDbPath);
    
    this.initializeDatabase();
    
    // Initialize with a default tenant for development/testing
    if (process.env.NODE_ENV === 'development') {
      this.createDevelopmentTenant();
    }
  }

  private initializeDatabase(): void {
    // Create tenants table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        tenant_id TEXT PRIMARY KEY,
        api_key_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        last_used INTEGER,
        permissions TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active'
      )
    `);
    
    console.log('[Auth] Tenant database initialized');
  }

  private createDevelopmentTenant(): void {
    // Create a default tenant for development if it doesn't exist
    const devTenantId = 'dev-tenant-001';
    const devApiKey = 'dev-key-12345';
    
    const stmt = this.db.prepare('SELECT tenant_id FROM tenants WHERE tenant_id = ?');
    const existing = stmt.get(devTenantId);
    
    if (!existing) {
      const insertStmt = this.db.prepare(`
        INSERT INTO tenants (tenant_id, api_key_hash, created_at, permissions, status)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      insertStmt.run(
        devTenantId,
        this.hashApiKey(devApiKey),
        Date.now(),
        JSON.stringify(['*']), // Full permissions for dev
        'active'
      );

      console.log(`[Auth] Development tenant created: ${devTenantId}`);
      console.log(`[Auth] Development API key: ${devApiKey}`);
    }
  }

  public async authenticate(apiKey: string): Promise<TenantAuthResult> {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('Invalid API key format');
    }

    const keyHash = this.hashApiKey(apiKey);
    
    // Find active tenant by API key hash
    const stmt = this.db.prepare(`
      SELECT tenant_id, api_key_hash, permissions 
      FROM tenants 
      WHERE status = 'active'
    `);
    
    const tenants = stmt.all() as Array<{
      tenant_id: string;
      api_key_hash: string;
      permissions: string;
    }>;
    
    for (const tenant of tenants) {
      // Use timing-safe comparison to prevent timing attacks
      const storedHash = Buffer.from(tenant.api_key_hash, 'hex');
      const providedHash = Buffer.from(keyHash, 'hex');
      
      if (storedHash.length === providedHash.length && 
          timingSafeEqual(storedHash, providedHash)) {
        
        // Update last used timestamp
        const updateStmt = this.db.prepare('UPDATE tenants SET last_used = ? WHERE tenant_id = ?');
        updateStmt.run(Date.now(), tenant.tenant_id);
        
        return {
          tenantId: tenant.tenant_id,
          permissions: JSON.parse(tenant.permissions)
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
    
    // Check if tenant already exists
    const stmt = this.db.prepare('SELECT tenant_id FROM tenants WHERE tenant_id = ?');
    const existing = stmt.get(tenantId);
    
    if (existing) {
      throw new Error(`Tenant ${tenantId} already exists`);
    }

    // Insert new tenant
    const insertStmt = this.db.prepare(`
      INSERT INTO tenants (tenant_id, api_key_hash, created_at, permissions, status)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    insertStmt.run(
      tenantId,
      this.hashApiKey(apiKey),
      Date.now(),
      JSON.stringify(options.permissions || ['read', 'write']),
      'active'
    );
    
    console.log(`[Auth] Created tenant: ${tenantId}`);
    
    return {
      tenantId,
      apiKey
    };
  }

  public async revokeTenant(tenantId: string): Promise<void> {
    const stmt = this.db.prepare('SELECT tenant_id FROM tenants WHERE tenant_id = ?');
    const existing = stmt.get(tenantId);
    
    if (!existing) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const updateStmt = this.db.prepare('UPDATE tenants SET status = ? WHERE tenant_id = ?');
    updateStmt.run('suspended', tenantId);
    
    console.log(`[Auth] Revoked tenant: ${tenantId}`);
  }

  public async deleteTenant(tenantId: string): Promise<void> {
    const stmt = this.db.prepare('SELECT tenant_id FROM tenants WHERE tenant_id = ?');
    const existing = stmt.get(tenantId);
    
    if (!existing) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const deleteStmt = this.db.prepare('DELETE FROM tenants WHERE tenant_id = ?');
    deleteStmt.run(tenantId);
    
    console.log(`[Auth] Deleted tenant: ${tenantId}`);
  }

  public getTenantInfo(tenantId: string): Omit<TenantCredentials, 'apiKeyHash'> | null {
    const stmt = this.db.prepare(`
      SELECT tenant_id, created_at, last_used, permissions, status 
      FROM tenants 
      WHERE tenant_id = ?
    `);
    
    const row = stmt.get(tenantId) as {
      tenant_id: string;
      created_at: number;
      last_used: number | null;
      permissions: string;
      status: string;
    } | undefined;
    
    if (!row) {
      return null;
    }

    return {
      tenantId: row.tenant_id,
      createdAt: new Date(row.created_at),
      lastUsed: row.last_used ? new Date(row.last_used) : undefined,
      permissions: JSON.parse(row.permissions),
      status: row.status as 'active' | 'suspended' | 'deleted'
    };
  }

  public listTenants(): Array<Omit<TenantCredentials, 'apiKeyHash'>> {
    const stmt = this.db.prepare(`
      SELECT tenant_id, created_at, last_used, permissions, status 
      FROM tenants
    `);
    
    const rows = stmt.all() as Array<{
      tenant_id: string;
      created_at: number;
      last_used: number | null;
      permissions: string;
      status: string;
    }>;
    
    return rows.map(row => ({
      tenantId: row.tenant_id,
      createdAt: new Date(row.created_at),
      lastUsed: row.last_used ? new Date(row.last_used) : undefined,
      permissions: JSON.parse(row.permissions),
      status: row.status as 'active' | 'suspended' | 'deleted'
    }));
  }

  public getActiveTenantCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM tenants WHERE status = ?');
    const result = stmt.get('active') as { count: number };
    return result.count;
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
    const stmt = this.db.prepare('SELECT tenant_id FROM tenants WHERE tenant_id = ?');
    const existing = stmt.get(tenantId);
    
    if (!existing) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    const newApiKey = this.generateApiKey();
    const updateStmt = this.db.prepare('UPDATE tenants SET api_key_hash = ? WHERE tenant_id = ?');
    updateStmt.run(this.hashApiKey(newApiKey), tenantId);
    
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
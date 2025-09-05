/**
 * Database Migration System for MCP Context Memory
 * Handles schema version management and upgrades
 */

import Database from 'better-sqlite3';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DatabaseError } from '../../utils/errors.js';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
  down?: (db: Database.Database) => void;
}

export class MigrationManager {
  private db: Database.Database;
  private migrationsPath: string;

  constructor(db: Database.Database, migrationsPath?: string) {
    this.db = db;
    const __dirname = dirname(fileURLToPath(import.meta.url));
    this.migrationsPath = migrationsPath || __dirname;
    this.ensureMigrationTable();
  }

  /**
   * Ensure migration tracking table exists
   */
  private ensureMigrationTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  /**
   * Get current schema version
   */
  getCurrentVersion(): number {
    const result = this.db.prepare(
      'SELECT MAX(version) as version FROM schema_migrations'
    ).get() as { version: number | null };
    
    return result.version || 0;
  }

  /**
   * Check if a specific version has been applied
   */
  isVersionApplied(version: number): boolean {
    const result = this.db.prepare(
      'SELECT 1 FROM schema_migrations WHERE version = ?'
    ).get(version);
    
    return !!result;
  }

  /**
   * Load all migrations from the migrations directory
   */
  async loadMigrations(): Promise<Migration[]> {
    const migrations: Migration[] = [];
    
    // Import the index file that exports all migrations
    try {
      // Try to import the TypeScript file first (for tests), then fallback to JS
      const indexPath = join(this.migrationsPath, 'index');
      let migrationModule;
      
      try {
        // For test environment - import TypeScript directly
        migrationModule = await import(indexPath + '.ts');
      } catch (e) {
        // For production - import compiled JavaScript
        migrationModule = await import(indexPath + '.js');
      }
      
      return migrationModule.migrations || [];
    } catch (error) {
      throw new DatabaseError(`Failed to load migrations: ${(error as Error).message}`);
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    const currentVersion = this.getCurrentVersion();
    const migrations = await this.loadMigrations();
    
    // Sort migrations by version
    migrations.sort((a, b) => a.version - b.version);
    
    // Run pending migrations in a transaction
    this.db.transaction(() => {
      for (const migration of migrations) {
        if (migration.version > currentVersion) {
          try {
            // console.log(`Running migration ${migration.version}: ${migration.name}`);
            migration.up(this.db);
            
            // Record the migration
            this.db.prepare(
              'INSERT INTO schema_migrations (version, name) VALUES (?, ?)'
            ).run(migration.version, migration.name);
            
            // console.log(`✅ Migration ${migration.version} completed`);
          } catch (error) {
            throw new DatabaseError(
              `Migration ${migration.version} failed: ${(error as Error).message}`
            );
          }
        }
      }
    })();
  }

  /**
   * Rollback to a specific version
   */
  async rollback(targetVersion: number): Promise<void> {
    const currentVersion = this.getCurrentVersion();
    
    if (targetVersion >= currentVersion) {
      throw new DatabaseError(
        `Cannot rollback to version ${targetVersion} (current: ${currentVersion})`
      );
    }
    
    const migrations = await this.loadMigrations();
    
    // Sort migrations by version descending for rollback
    migrations.sort((a, b) => b.version - a.version);
    
    // Run rollbacks in a transaction
    this.db.transaction(() => {
      for (const migration of migrations) {
        if (migration.version > targetVersion && migration.version <= currentVersion) {
          if (!migration.down) {
            throw new DatabaseError(
              `Migration ${migration.version} does not support rollback`
            );
          }
          
          try {
            console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
            migration.down(this.db);
            
            // Remove the migration record
            this.db.prepare(
              'DELETE FROM schema_migrations WHERE version = ?'
            ).run(migration.version);
            
            console.log(`✅ Rollback of migration ${migration.version} completed`);
          } catch (error) {
            throw new DatabaseError(
              `Rollback of migration ${migration.version} failed: ${(error as Error).message}`
            );
          }
        }
      }
    })();
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    currentVersion: number;
    appliedMigrations: Array<{ version: number; name: string; applied_at: string }>;
    pendingMigrations: Array<{ version: number; name: string }>;
  }> {
    const currentVersion = this.getCurrentVersion();
    const appliedMigrations = this.db.prepare(
      'SELECT version, name, applied_at FROM schema_migrations ORDER BY version'
    ).all() as Array<{ version: number; name: string; applied_at: string }>;
    
    const allMigrations = await this.loadMigrations();
    const pendingMigrations = allMigrations
      .filter(m => m.version > currentVersion)
      .map(m => ({ version: m.version, name: m.name }));
    
    return {
      currentVersion,
      appliedMigrations,
      pendingMigrations
    };
  }
}

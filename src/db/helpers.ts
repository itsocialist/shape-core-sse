/**
 * Helper functions for role tools
 */

import Database from 'better-sqlite3';
import { homedir, hostname } from 'os';
import { DatabaseManager } from './database.js';

// Re-export DatabaseManager for backward compatibility
export { DatabaseManager };

// Global database instance
let globalDb: DatabaseManager | null = null;

/**
 * Set a custom database instance (for testing)
 */
export function setTestDatabase(db: Database.Database | null): void {
  if (db) {
    // Create a mock DatabaseManager wrapper
    globalDb = {
      db,
      close: () => db.close(),
      getMigrationStatus: () => ({ currentVersion: 3, pendingMigrations: [] })
    } as any;
  } else {
    globalDb = null;
  }
}

/**
 * Get or create the database instance
 */
export async function getDatabase(): Promise<Database.Database> {
  if (!globalDb) {
    // Use Shape Core database path when in pro mode
    const isProMode = process.env.SHAPE_PRO_MODE === 'true' || 
                     !process.env.SHAPE_BASIC_MODE;
    
    const dbPath = isProMode 
      ? (process.env.SHAPE_PRO_DB_PATH || `${homedir()}/.shape-core/shape-core.db`)
      : (process.env.MCP_CONTEXT_DB_PATH || `${homedir()}/.mcp-context-memory/context.db`);
      
    globalDb = await DatabaseManager.create(dbPath);
  }
  return (globalDb as any).db; // Access internal db for direct operations
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (globalDb) {
    globalDb.close();
    globalDb = null;
  }
}

/**
 * Get or create current system ID
 */
export async function getCurrentSystemId(db: Database.Database): Promise<number> {
  const systemName = hostname();
  const platform = process.platform;
  
  // Check if system exists
  let system = db.prepare(
    'SELECT id FROM systems WHERE hostname = ? AND is_current = 1'
  ).get(systemName) as { id: number } | undefined;
  
  if (!system) {
    // Create new system entry
    const result = db.prepare(`
      INSERT INTO systems (name, hostname, platform, is_current)
      VALUES (?, ?, ?, 1)
    `).run(systemName, systemName, platform);
    
    return result.lastInsertRowid as number;
  }
  
  return system.id;
}

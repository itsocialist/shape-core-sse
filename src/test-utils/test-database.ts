/**
 * Test database utilities for proper test isolation
 */

import { DatabaseManager } from '../db/database.js';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Creates a test database instance with isolation
 */
export class TestDatabaseManager {
  private static testDbs: Map<string, DatabaseManager> = new Map();
  
  /**
   * Create a test database with a unique name
   */
  static async createTestDatabase(testName: string = 'test'): Promise<DatabaseManager> {
    const timestamp = Date.now();
    const dbPath = join(tmpdir(), `mcp-context-test-${testName}-${timestamp}.db`);
    
    // Ensure no existing database
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
    
    const db = await DatabaseManager.create(dbPath);
    this.testDbs.set(dbPath, db);
    
    return db;
  }
  
  /**
   * Clean up a specific test database
   */
  static async cleanupDatabase(db: DatabaseManager): Promise<void> {
    const dbPath = (db as any).dbPath;
    
    // Close the database
    db.close();
    
    // Remove from tracking
    this.testDbs.delete(dbPath);
    
    // Delete the file
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  }
  
  /**
   * Clean up all test databases
   */
  static async cleanupAll(): Promise<void> {
    for (const [dbPath, db] of this.testDbs.entries()) {
      try {
        db.close();
        if (existsSync(dbPath)) {
          unlinkSync(dbPath);
        }
      } catch (error) {
        console.error(`Failed to cleanup ${dbPath}:`, error);
      }
    }
    this.testDbs.clear();
  }
}

/**
 * Jest lifecycle hooks for test database management
 */
export function setupTestDatabase() {
  // Clean up after all tests
  if (typeof afterAll !== 'undefined') {
    afterAll(async () => {
      await TestDatabaseManager.cleanupAll();
    });
  }
  
  // Also clean up on process exit
  process.on('exit', () => {
    TestDatabaseManager.cleanupAll();
  });
}

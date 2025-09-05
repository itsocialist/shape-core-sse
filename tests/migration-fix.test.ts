/**
 * Test for fixing migration 002/004 role_id column conflict
 * Ensures migrations can run successfully without column duplication errors
 */

import { DatabaseManager } from '../src/db/database.js';
import { TestDatabaseManager } from '../src/test-utils/test-database.js';

describe('Migration Fix Tests', () => {
  let db: DatabaseManager;

  beforeEach(async () => {
    db = await TestDatabaseManager.createTestDatabase('migration-fix');
  });

  afterEach(async () => {
    if (db) {
      await TestDatabaseManager.cleanupDatabase(db);
    }
  });

  test('should successfully run all migrations without role_id column conflicts', async () => {
    // Database should be initialized without throwing duplicate column errors
    expect(db).toBeDefined();
    
    // Verify the database has the correct schema version
    const version = db.getSchemaVersion();
    expect(version).toBeGreaterThanOrEqual(4);
  });

  test('should have role_id column in context_entries table', async () => {
    // Check that context_entries table has role_id column
    const tableInfo = db.db.prepare("PRAGMA table_info(context_entries)").all();
    const roleIdColumn = tableInfo.find((col: any) => col.name === 'role_id');
    
    expect(roleIdColumn).toBeDefined();
    expect(roleIdColumn.type).toBe('TEXT');
  });

  test('should have all required role-related tables', async () => {
    // Check that all role tables from migration 002 exist
    const tables = db.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('roles', 'project_roles', 'role_handoffs', 'active_roles')
    `).all();
    
    expect(tables).toHaveLength(4);
    expect(tables.map((t: any) => t.name)).toEqual(
      expect.arrayContaining(['roles', 'project_roles', 'role_handoffs', 'active_roles'])
    );
  });

  test('should have all enhanced project management tables from migration 004', async () => {
    // Check that migration 004 tables exist
    const tables = db.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name IN ('epics', 'sprints', 'stories', 'issues')
    `).all();
    
    expect(tables).toHaveLength(4);
    expect(tables.map((t: any) => t.name)).toEqual(
      expect.arrayContaining(['epics', 'sprints', 'stories', 'issues'])
    );
  });
});

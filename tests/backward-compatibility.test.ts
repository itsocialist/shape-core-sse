/**
 * Backward compatibility tests for role features
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { migration_002_roles } from '../src/db/migrations/002_roles';

describe('Role Backward Compatibility', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    
    // Setup base schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        status TEXT DEFAULT 'active',
        repository_url TEXT,
        local_directory TEXT,
        primary_system_id INTEGER,
        tags JSON DEFAULT '[]',
        metadata JSON DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS context_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id),
        system_id INTEGER,
        type TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        is_system_specific BOOLEAN DEFAULT FALSE,
        tags JSON DEFAULT '[]',
        metadata JSON DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS update_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details JSON,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS systems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        hostname TEXT NOT NULL,
        platform TEXT NOT NULL,
        is_current BOOLEAN DEFAULT FALSE,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert existing data before migration
    db.prepare('INSERT INTO projects (name) VALUES (?)').run('existing-project');
    db.prepare(`
      INSERT INTO context_entries (project_id, type, key, value)
      VALUES (1, 'decision', 'old-decision', 'Made before roles')
    `).run();
  });

  afterEach(() => {
    db.close();
  });

  it('should migrate without losing existing data', () => {
    // Run migration
    migration_002_roles.up(db);

    // Verify existing data is preserved
    const project = db.prepare('SELECT * FROM projects WHERE name = ?')
      .get('existing-project');
    expect(project).toBeDefined();
    expect(project.name).toBe('existing-project');

    const context = db.prepare('SELECT * FROM context_entries WHERE key = ?')
      .get('old-decision');
    expect(context).toBeDefined();
    expect(context.value).toBe('Made before roles');
  });

  it('should allow null role_id for backward compatibility', () => {
    migration_002_roles.up(db);

    // Old contexts should have null role_id
    const oldContext = db.prepare('SELECT role_id FROM context_entries WHERE key = ?')
      .get('old-decision');
    expect(oldContext.role_id).toBeNull();

    // New contexts can still be created without role
    db.prepare(`
      INSERT INTO context_entries (project_id, type, key, value, role_id)
      VALUES (1, 'note', 'no-role-note', 'Created without role', NULL)
    `).run();

    const newContext = db.prepare('SELECT * FROM context_entries WHERE key = ?')
      .get('no-role-note');
    expect(newContext).toBeDefined();
    expect(newContext.role_id).toBeNull();
  });

  it('should maintain existing search functionality', () => {
    migration_002_roles.up(db);

    // Create FTS5 table (simplified version)
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS context_search USING fts5(
        key, value, type, tags,
        content='context_entries',
        content_rowid='id'
      );
    `);

    // Search should work with or without role filtering
    const allResults = db.prepare(`
      SELECT ce.* FROM context_entries ce
      WHERE ce.key LIKE '%decision%'
    `).all();

    expect(allResults).toHaveLength(1);
    expect(allResults[0].key).toBe('old-decision');
  });

  it('should allow projects without active roles', () => {
    migration_002_roles.up(db);

    // Project without active role should work fine
    const activeRole = db.prepare(`
      SELECT * FROM active_roles WHERE project_id = 1
    `).get();

    expect(activeRole).toBeUndefined();

    // Should still be able to add contexts
    db.prepare(`
      INSERT INTO context_entries (project_id, type, key, value)
      VALUES (1, 'todo', 'task-without-role', 'Works without active role')
    `).run();

    const context = db.prepare('SELECT * FROM context_entries WHERE key = ?')
      .get('task-without-role');
    expect(context).toBeDefined();
  });
});

/**
 * Test Migration - Creates minimal schema for testing
 * Part of Story 1.2: Enhanced Schema Evolution Framework
 */

import type { Migration } from './migrationManager.js';
import Database from 'better-sqlite3';

export const testMigration: Migration = {
  version: 1,
  name: 'test_base_schema',
  
  up: (db: Database.Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS context_entries (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        project_id TEXT,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        type TEXT DEFAULT 'note',
        tags TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        system_id TEXT,
        is_system_specific BOOLEAN DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);
  },
  
  down: (db: Database.Database) => {
    db.exec(`
      DROP TABLE IF EXISTS context_entries;
      DROP TABLE IF EXISTS projects;
    `);
  }
};

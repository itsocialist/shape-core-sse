/**
 * Initial schema migration
 * Creates the base tables for MCP Context Memory
 */

import type { Migration } from './migrationManager.js';
import Database from 'better-sqlite3';

export const migration001_initial_schema: Migration = {
  version: 1, // Fixed: should be 1 as the initial migration
  name: 'initial_schema_with_unique_index',
  
  up: (db: Database.Database) => {
    // This migration contains the initial schema from schema.ts
    // In a real migration system, this would be the first migration
    // For now, we'll just add the missing indexes
    
    // Add composite indexes for better performance
    db.exec(`
      -- Add unique constraint for upsert operations
      -- Using COALESCE to handle NULL project_id
      CREATE UNIQUE INDEX IF NOT EXISTS idx_context_unique_key 
      ON context_entries(COALESCE(project_id, -1), key);
      
      -- Composite index for project-type queries
      CREATE INDEX IF NOT EXISTS idx_context_project_type 
      ON context_entries(project_id, type);
      
      -- Composite index for project-time queries
      CREATE INDEX IF NOT EXISTS idx_context_project_updated 
      ON context_entries(project_id, updated_at DESC);
      
      -- Index for tag searches
      CREATE INDEX IF NOT EXISTS idx_context_tags 
      ON context_entries(tags);
      
      -- Index for system-specific queries
      CREATE INDEX IF NOT EXISTS idx_context_system 
      ON context_entries(system_id, is_system_specific);
    `);
  },
  
  down: (db: Database.Database) => {
    // Drop the indexes
    db.exec(`
      DROP INDEX IF EXISTS idx_context_unique_key;
      DROP INDEX IF EXISTS idx_context_project_type;
      DROP INDEX IF EXISTS idx_context_project_updated;
      DROP INDEX IF EXISTS idx_context_tags;
      DROP INDEX IF EXISTS idx_context_system;
    `);
  }
};

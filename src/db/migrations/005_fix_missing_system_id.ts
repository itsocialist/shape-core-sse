/**
 * Migration to fix missing system_id column in projects table for enhanced-database-manager
 * Version: 005
 * Description: Adds system_id column to projects table that enhanced manager expects
 */

import type { Migration } from './migrationManager.js';
import Database from 'better-sqlite3';

export const migration005: Migration = {
  version: 5,
  name: 'fix_missing_system_id_column',
  
  up: (db: Database.Database) => {
    // Check if system_id column exists in projects table
    const tableInfo = db.prepare("PRAGMA table_info(projects)").all() as any[];
    const hasSystemId = tableInfo.some((col: any) => col.name === 'system_id');
    
    if (!hasSystemId) {
      // Add the missing system_id column that enhanced database manager expects
      db.exec(`
        ALTER TABLE projects ADD COLUMN system_id INTEGER;
        
        -- Update existing projects to use the current system's ID if available
        UPDATE projects SET system_id = (
          SELECT id FROM systems WHERE is_current = 1 LIMIT 1
        ) WHERE system_id IS NULL;
        
        -- Create index for the new column
        CREATE INDEX IF NOT EXISTS idx_projects_system_id ON projects(system_id);
      `);
    }
  },
  
  down: (db: Database.Database) => {
    // Remove the system_id column by recreating table without it
    db.exec(`
      CREATE TABLE projects_temp AS SELECT 
        id, name, description, status, repository_url, local_directory, 
        primary_system_id, tags, metadata, created_at, updated_at, last_accessed
      FROM projects;
      
      DROP TABLE projects;
      ALTER TABLE projects_temp RENAME TO projects;
      
      -- Recreate original indexes
      CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
      CREATE INDEX IF NOT EXISTS idx_projects_system ON projects(primary_system_id);
    `);
  }
};

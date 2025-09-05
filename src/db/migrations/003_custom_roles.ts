/**
 * Migration 003: Add custom roles support
 * Minimal changes for MVP - extends existing roles table
 */

import { Database } from 'better-sqlite3';

export const migration_003_custom_roles = {
  version: 3, // Fixed: should be 3 to avoid conflict with migration 004
  name: 'Add custom roles support',
  
  up: (db: Database) => {
    // console.log('Adding custom roles support...');
    
    // Add columns to roles table for custom role support
    // Note: is_custom already exists from initial schema
    db.exec(`
      ALTER TABLE roles 
      ADD COLUMN parent_template TEXT;
    `);
    
    db.exec(`
      ALTER TABLE roles 
      ADD COLUMN author_system_id INTEGER REFERENCES systems(id);
    `);
    
    // Create role_templates table for future marketplace
    db.exec(`
      CREATE TABLE IF NOT EXISTS role_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        base_config JSON NOT NULL,
        author TEXT,
        downloads INTEGER DEFAULT 0,
        version TEXT DEFAULT '1.0.0',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Create index for finding custom roles by author
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_roles_author 
      ON roles(author_system_id);
    `);
    
    // Create index for templates
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_templates_downloads 
      ON role_templates(downloads DESC);
    `);
    
    // console.log('✅ Custom roles support added successfully');
  },
  
  down: (db: Database) => {
    // console.log('Removing custom roles support...');
    
    // Drop indexes
    db.exec(`
      DROP INDEX IF EXISTS idx_roles_author;
      DROP INDEX IF EXISTS idx_templates_downloads;
    `);
    
    // Drop role_templates table
    db.exec(`
      DROP TABLE IF EXISTS role_templates;
    `);
    
    // Note: We can't easily remove columns in SQLite
    // Would need to recreate the table, which is risky
    // For now, we'll leave the columns but document this limitation
    // console.log('⚠️  Note: Added columns remain in roles table (SQLite limitation)');
  }
};

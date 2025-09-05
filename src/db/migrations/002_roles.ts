import { Database } from 'better-sqlite3';

export const migration_002_roles = {
  version: 2,
  name: 'Add role-based features',
  
  up: (db: Database) => {
    // Create roles table
    db.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_custom BOOLEAN DEFAULT FALSE,
        template_config JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create project_roles table
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_roles (
        project_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        custom_config JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (project_id, role_id),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (role_id) REFERENCES roles(id)
      );
    `);
    // Create role_handoffs table
    db.exec(`
      CREATE TABLE IF NOT EXISTS role_handoffs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        from_role_id TEXT NOT NULL,
        to_role_id TEXT NOT NULL,
        handoff_data JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by_system_id TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (from_role_id) REFERENCES roles(id),
        FOREIGN KEY (to_role_id) REFERENCES roles(id)
      );
    `);

    // Create active_roles table
    db.exec(`
      CREATE TABLE IF NOT EXISTS active_roles (
        project_id TEXT NOT NULL,
        system_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (project_id, system_id),
        FOREIGN KEY (project_id) REFERENCES projects(id),
        FOREIGN KEY (role_id) REFERENCES roles(id),
        FOREIGN KEY (system_id) REFERENCES systems(id)
      );
    `);

    // Add role_id to existing tables
    db.exec(`
      ALTER TABLE context_entries ADD COLUMN role_id TEXT REFERENCES roles(id);
      ALTER TABLE update_history ADD COLUMN role_id TEXT REFERENCES roles(id);
    `);

    // Create indexes for performance
    db.exec(`
      CREATE INDEX idx_context_entries_role ON context_entries(project_id, role_id);
      CREATE INDEX idx_context_entries_role_type ON context_entries(project_id, role_id, type);
      CREATE INDEX idx_role_handoffs_project ON role_handoffs(project_id);
      CREATE INDEX idx_active_roles_system ON active_roles(system_id);
    `);

    // Insert default roles
    const stmt = db.prepare(`
      INSERT INTO roles (id, name, description, is_custom, template_config)
      VALUES (?, ?, ?, ?, ?)
    `);

    const defaultRoles = [
      {
        id: 'architect',
        name: 'Software Architect',
        description: 'Responsible for system design, architecture decisions, and technical standards',
        templateConfig: {
          focusAreas: ['system-design', 'patterns', 'constraints', 'decisions'],
          defaultTags: ['architecture', 'design', 'decision'],
          contextTypes: ['decision', 'standard', 'reference']
        }
      },
      {
        id: 'developer',
        name: 'Software Developer',
        description: 'Implements features, writes code, and maintains code quality',
        templateConfig: {
          focusAreas: ['implementation', 'code-patterns', 'debugging', 'features'],
          defaultTags: ['implementation', 'code', 'feature'],
          contextTypes: ['code', 'todo', 'issue', 'note']
        }
      },
      {
        id: 'devops',
        name: 'DevOps Engineer',
        description: 'Manages deployment, infrastructure, and operational concerns',
        templateConfig: {
          focusAreas: ['deployment', 'infrastructure', 'monitoring', 'ci-cd'],
          defaultTags: ['deployment', 'infrastructure', 'operations'],
          contextTypes: ['config', 'status', 'issue', 'decision']
        }
      },
      {
        id: 'qa',
        name: 'QA Engineer',
        description: 'Ensures quality through testing, bug tracking, and test planning',
        templateConfig: {
          focusAreas: ['testing', 'quality', 'bugs', 'test-plans'],
          defaultTags: ['testing', 'quality', 'bug'],
          contextTypes: ['issue', 'todo', 'standard', 'note']
        }
      },
      {
        id: 'product',
        name: 'Product Manager',
        description: 'Defines requirements, priorities, and product direction',
        templateConfig: {
          focusAreas: ['requirements', 'user-stories', 'priorities', 'roadmap'],
          defaultTags: ['product', 'requirement', 'priority'],
          contextTypes: ['decision', 'todo', 'reference', 'note']
        }
      }
    ];

    for (const role of defaultRoles) {
      stmt.run(
        role.id,
        role.name,
        role.description,
        0, // is_custom = false
        JSON.stringify(role.templateConfig)
      );
    }

    // Update triggers for updated_at
    db.exec(`
      CREATE TRIGGER update_roles_timestamp 
      AFTER UPDATE ON roles
      FOR EACH ROW
      BEGIN
        UPDATE roles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `);
  },

  down: (db: Database) => {
    // Remove indexes
    db.exec(`
      DROP INDEX IF EXISTS idx_context_entries_role;
      DROP INDEX IF EXISTS idx_context_entries_role_type;
      DROP INDEX IF EXISTS idx_role_handoffs_project;
      DROP INDEX IF EXISTS idx_active_roles_system;
    `);

    // Remove triggers
    db.exec(`
      DROP TRIGGER IF EXISTS update_roles_timestamp;
    `);

    // Remove role_id columns (this will lose data!)
    db.exec(`
      -- SQLite doesn't support DROP COLUMN directly, would need to recreate tables
      -- For now, we'll just note this limitation
      -- In production, would need to create new tables, copy data, drop old, rename
    `);

    // Drop new tables
    db.exec(`
      DROP TABLE IF EXISTS active_roles;
      DROP TABLE IF EXISTS role_handoffs;
      DROP TABLE IF EXISTS project_roles;
      DROP TABLE IF EXISTS roles;
    `);
  }
};

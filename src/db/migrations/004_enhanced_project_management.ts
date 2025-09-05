/**
 * Migration for enhanced data taxonomy - comprehensive project management features
 * Version: 004
 * Description: Adds epics, sprints, stories, issues, versions, releases, team practices, role memory
 */

import type { Migration } from './migrationManager.js';
import Database from 'better-sqlite3';

export const migration004: Migration = {
  version: 4,
  name: 'enhanced_project_management_taxonomy',
  
  up: (db: Database.Database) => {
    db.exec(`
    -- Enhanced projects table with required metadata
    ALTER TABLE projects ADD COLUMN project_directory TEXT;
    ALTER TABLE projects ADD COLUMN workflow_type TEXT CHECK (workflow_type IN ('agile-scrum', 'agile-kanban', 'waterfall', 'lean', 'custom'));
    ALTER TABLE projects ADD COLUMN team_data TEXT; -- JSON object for role assignments
    ALTER TABLE projects ADD COLUMN source_control_url TEXT;

    -- Create indexes on new project fields
    CREATE INDEX IF NOT EXISTS idx_projects_directory ON projects(project_directory);
    CREATE INDEX IF NOT EXISTS idx_projects_source_control ON projects(source_control_url);

    -- Epics table
    CREATE TABLE IF NOT EXISTS epics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('planning', 'ready', 'in_progress', 'review', 'completed', 'cancelled', 'on_hold')),
      priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
      business_value TEXT NOT NULL,
      acceptance_criteria TEXT NOT NULL, -- JSON array
      estimated_story_points INTEGER DEFAULT 0,
      actual_story_points INTEGER DEFAULT 0,
      target_version TEXT,
      start_date TEXT,
      end_date TEXT,
      assigned_to_role TEXT,
      tags TEXT, -- JSON array
      metadata TEXT, -- JSON object
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Sprints table
    CREATE TABLE IF NOT EXISTS sprints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      capacity_story_points INTEGER NOT NULL,
      sprint_goal TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
      retrospective_notes TEXT,
      velocity_achieved INTEGER DEFAULT 0,
      burndown_data TEXT, -- JSON array of daily burndown data
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Stories table
    CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      epic_id INTEGER,
      sprint_id INTEGER,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      acceptance_criteria TEXT NOT NULL, -- JSON array
      story_points INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
      status TEXT NOT NULL CHECK (status IN ('backlog', 'ready_for_development', 'in_progress', 'code_review', 'testing', 'ready_for_deployment', 'completed', 'cancelled')),
      type TEXT NOT NULL CHECK (type IN ('feature', 'bug', 'technical_debt', 'research', 'documentation')),
      assignee_role TEXT,
      reviewer_role TEXT,
      labels TEXT, -- JSON array
      estimated_hours INTEGER,
      actual_hours INTEGER,
      blocked BOOLEAN DEFAULT 0,
      blocked_reason TEXT,
      dependencies TEXT, -- JSON array of story IDs
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (epic_id) REFERENCES epics(id) ON DELETE SET NULL,
      FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL
    );

    -- Story transitions for lifecycle tracking
    CREATE TABLE IF NOT EXISTS story_transitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      story_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      transitioned_by_role TEXT NOT NULL,
      transition_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
    );

    -- Issues table
    CREATE TABLE IF NOT EXISTS issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('bug', 'enhancement', 'task', 'question', 'documentation')),
      severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'trivial')),
      priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
      status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'review', 'testing', 'resolved', 'closed', 'reopened')),
      reporter_role TEXT NOT NULL,
      assignee_role TEXT,
      reproduction_steps TEXT, -- JSON array
      expected_behavior TEXT,
      actual_behavior TEXT,
      environment TEXT,
      browser_version TEXT,
      tags TEXT, -- JSON array
      resolution TEXT,
      resolution_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Link table for issues to stories/epics
    CREATE TABLE IF NOT EXISTS issue_relationships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_id INTEGER NOT NULL,
      related_type TEXT NOT NULL CHECK (related_type IN ('story', 'epic')),
      related_id INTEGER NOT NULL,
      relationship_type TEXT NOT NULL CHECK (relationship_type IN ('blocks', 'blocked_by', 'related_to', 'caused_by')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
    );

    -- Project versions table
    CREATE TABLE IF NOT EXISTS project_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      version TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('major', 'minor', 'patch', 'hotfix')),
      status TEXT NOT NULL CHECK (status IN ('planning', 'in_development', 'feature_freeze', 'testing', 'release_candidate', 'released', 'deprecated')),
      changelog_summary TEXT NOT NULL,
      breaking_changes BOOLEAN DEFAULT 0,
      target_date TEXT,
      release_date TEXT,
      previous_version_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (previous_version_id) REFERENCES project_versions(id),
      UNIQUE(project_id, version)
    );

    -- Epic-Version associations
    CREATE TABLE IF NOT EXISTS epic_versions (
      epic_id INTEGER NOT NULL,
      version_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (epic_id, version_id),
      FOREIGN KEY (epic_id) REFERENCES epics(id) ON DELETE CASCADE,
      FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE CASCADE
    );

    -- Releases table
    CREATE TABLE IF NOT EXISTS releases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version_id INTEGER NOT NULL,
      release_name TEXT NOT NULL,
      release_date TEXT NOT NULL,
      environment TEXT NOT NULL CHECK (environment IN ('development', 'testing', 'staging', 'production', 'demo')),
      deployment_method TEXT NOT NULL CHECK (deployment_method IN ('manual', 'automated', 'blue_green', 'canary', 'rolling')),
      status TEXT NOT NULL CHECK (status IN ('planned', 'in_progress', 'completed', 'failed', 'rolled_back', 'cancelled')),
      rollback_plan TEXT NOT NULL,
      deployment_notes TEXT NOT NULL,
      approval_required BOOLEAN DEFAULT 0,
      approved_by_role TEXT,
      approval_date TEXT,
      previous_release_id INTEGER,
      deployment_duration_minutes INTEGER,
      rollback_occurred BOOLEAN DEFAULT 0,
      rollback_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (version_id) REFERENCES project_versions(id) ON DELETE CASCADE,
      FOREIGN KEY (previous_release_id) REFERENCES releases(id)
    );

    -- Team practices table (cross-project knowledge)
    CREATE TABLE IF NOT EXISTS team_practices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      practice_name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL CHECK (category IN ('development', 'testing', 'deployment', 'security', 'performance', 'documentation', 'communication', 'planning')),
      description TEXT NOT NULL,
      implementation_details TEXT NOT NULL, -- JSON object
      success_criteria TEXT NOT NULL, -- JSON array
      created_by_role TEXT NOT NULL,
      applicable_roles TEXT NOT NULL, -- JSON array
      tags TEXT, -- JSON array
      adoption_count INTEGER DEFAULT 0,
      effectiveness_score REAL DEFAULT 0.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Practice adoptions (how practices are used in projects)
    CREATE TABLE IF NOT EXISTS practice_adoptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      practice_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      adopted_by_role TEXT NOT NULL,
      adoption_date TEXT NOT NULL,
      customizations TEXT, -- JSON array
      success_metrics TEXT, -- JSON object
      feedback TEXT,
      still_in_use BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (practice_id) REFERENCES team_practices(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      UNIQUE(practice_id, project_id)
    );

    -- Role project memory (project-specific role context)
    CREATE TABLE IF NOT EXISTS role_project_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      context_type TEXT NOT NULL CHECK (context_type IN ('architectural_decisions', 'implementation_notes', 'testing_strategies', 'deployment_configs', 'performance_insights', 'security_considerations', 'code_patterns', 'lessons_learned', 'current_work', 'blockers_and_issues')),
      context_data TEXT NOT NULL, -- JSON object
      tags TEXT, -- JSON array
      access_level TEXT NOT NULL CHECK (access_level IN ('public', 'project_team', 'role_specific', 'private')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Role memory changes tracking
    CREATE TABLE IF NOT EXISTS role_memory_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_memory_id INTEGER NOT NULL,
      change_type TEXT NOT NULL CHECK (change_type IN ('creation', 'update', 'deletion', 'access_change')),
      old_data TEXT, -- JSON object
      new_data TEXT, -- JSON object
      changed_by_role TEXT NOT NULL,
      change_reason TEXT,
      change_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_memory_id) REFERENCES role_project_memory(id) ON DELETE CASCADE
    );

    -- Cross-project role memory (patterns and knowledge across projects)
    CREATE TABLE IF NOT EXISTS role_cross_project_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      pattern_name TEXT NOT NULL,
      pattern_data TEXT NOT NULL, -- JSON object
      usage_count INTEGER DEFAULT 0,
      success_rate REAL DEFAULT 0.0,
      applicable_project_types TEXT, -- JSON array
      tags TEXT, -- JSON array
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(role, pattern_name)
    );

    -- Role skill progression tracking
    CREATE TABLE IF NOT EXISTS role_skill_progressions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      project_id INTEGER NOT NULL,
      skills_demonstrated TEXT NOT NULL, -- JSON array
      complexity_level TEXT NOT NULL CHECK (complexity_level IN ('beginner', 'intermediate', 'advanced', 'expert')),
      success_rating REAL NOT NULL CHECK (success_rating >= 0 AND success_rating <= 5),
      learning_outcomes TEXT, -- JSON array
      areas_for_improvement TEXT, -- JSON array
      recorded_date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    -- Enhanced context entries with additional associations
    -- Note: role_id column already added in migration 002
    ALTER TABLE context_entries ADD COLUMN epic_id INTEGER REFERENCES epics(id);
    ALTER TABLE context_entries ADD COLUMN story_id INTEGER REFERENCES stories(id);
    ALTER TABLE context_entries ADD COLUMN sprint_id INTEGER REFERENCES sprints(id);
    ALTER TABLE context_entries ADD COLUMN version_id INTEGER REFERENCES project_versions(id);

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_epics_project_status ON epics(project_id, status);
    CREATE INDEX IF NOT EXISTS idx_epics_target_version ON epics(target_version);
    CREATE INDEX IF NOT EXISTS idx_sprints_project_dates ON sprints(project_id, start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_stories_epic ON stories(epic_id);
    CREATE INDEX IF NOT EXISTS idx_stories_sprint ON stories(sprint_id);
    CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);
    CREATE INDEX IF NOT EXISTS idx_stories_assignee ON stories(assignee_role);
    CREATE INDEX IF NOT EXISTS idx_story_transitions_story ON story_transitions(story_id);
    CREATE INDEX IF NOT EXISTS idx_issues_project_status ON issues(project_id, status);
    CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);
    CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues(assignee_role);
    CREATE INDEX IF NOT EXISTS idx_versions_project ON project_versions(project_id);
    CREATE INDEX IF NOT EXISTS idx_versions_status ON project_versions(status);
    CREATE INDEX IF NOT EXISTS idx_releases_version ON releases(version_id);
    CREATE INDEX IF NOT EXISTS idx_releases_environment ON releases(environment);
    CREATE INDEX IF NOT EXISTS idx_team_practices_category ON team_practices(category);
    CREATE INDEX IF NOT EXISTS idx_practice_adoptions_project ON practice_adoptions(project_id);
    CREATE INDEX IF NOT EXISTS idx_role_project_memory_project_role ON role_project_memory(project_id, role);
    CREATE INDEX IF NOT EXISTS idx_role_project_memory_context_type ON role_project_memory(context_type);
    CREATE INDEX IF NOT EXISTS idx_role_project_memory_access ON role_project_memory(access_level);
    CREATE INDEX IF NOT EXISTS idx_role_cross_project_role ON role_cross_project_memory(role);
    CREATE INDEX IF NOT EXISTS idx_role_skill_progressions_role ON role_skill_progressions(role);
    `);
  },
  
  down: (db: Database.Database) => {
    db.exec(`
    -- Remove enhanced context entries columns
    CREATE TABLE context_entries_backup AS SELECT 
      id, project_id, system_id, type, key, value, is_system_specific, tags, metadata, created_at, updated_at
    FROM context_entries;
    
    DROP TABLE context_entries;
    ALTER TABLE context_entries_backup RENAME TO context_entries;

    -- Drop all new tables (in reverse dependency order)
    DROP TABLE IF EXISTS role_skill_progressions;
    DROP TABLE IF EXISTS role_cross_project_memory;
    DROP TABLE IF EXISTS role_memory_changes;
    DROP TABLE IF EXISTS role_project_memory;
    DROP TABLE IF EXISTS practice_adoptions;
    DROP TABLE IF EXISTS team_practices;
    DROP TABLE IF EXISTS releases;
    DROP TABLE IF EXISTS epic_versions;
    DROP TABLE IF EXISTS project_versions;
    DROP TABLE IF EXISTS issue_relationships;
    DROP TABLE IF EXISTS issues;
    DROP TABLE IF EXISTS story_transitions;
    DROP TABLE IF EXISTS stories;
    DROP TABLE IF EXISTS sprints;
    DROP TABLE IF EXISTS epics;

    -- Remove enhanced project columns
    CREATE TABLE projects_backup AS SELECT 
      id, name, description, status, repository_url, local_directory, primary_system_id, tags, metadata, created_at, updated_at, last_accessed
    FROM projects;
    
    DROP TABLE projects;
    ALTER TABLE projects_backup RENAME TO projects;
    
    -- Recreate original indexes
    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_projects_system ON projects(primary_system_id);
    `);
  }
};

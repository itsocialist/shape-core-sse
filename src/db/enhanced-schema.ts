/**
 * Enhanced database schema for comprehensive project management
 * Extends existing schema with: epics, sprints, stories, issues, versions, releases, team practices, role memory
 */

export const enhancedSchema = `
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

-- Enhanced context entries with role association
ALTER TABLE context_entries ADD COLUMN role_id TEXT;
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

-- Full-text search for enhanced content
DROP TABLE IF EXISTS context_search;
CREATE VIRTUAL TABLE IF NOT EXISTS context_search USING fts5(
  entity_id,
  entity_type,
  content,
  tags,
  role,
  project_id
);

-- Triggers for maintaining data consistency and timestamps
CREATE TRIGGER IF NOT EXISTS update_epic_timestamp 
AFTER UPDATE ON epics
BEGIN
  UPDATE epics SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_sprint_timestamp 
AFTER UPDATE ON sprints
BEGIN
  UPDATE sprints SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_story_timestamp 
AFTER UPDATE ON stories
BEGIN
  UPDATE stories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_issue_timestamp 
AFTER UPDATE ON issues
BEGIN
  UPDATE issues SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_version_timestamp 
AFTER UPDATE ON project_versions
BEGIN
  UPDATE project_versions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_release_timestamp 
AFTER UPDATE ON releases
BEGIN
  UPDATE releases SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_team_practice_timestamp 
AFTER UPDATE ON team_practices
BEGIN
  UPDATE team_practices SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_practice_adoption_timestamp 
AFTER UPDATE ON practice_adoptions
BEGIN
  UPDATE practice_adoptions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_role_project_memory_timestamp 
AFTER UPDATE ON role_project_memory
BEGIN
  UPDATE role_project_memory SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_role_cross_project_memory_timestamp 
AFTER UPDATE ON role_cross_project_memory
BEGIN
  UPDATE role_cross_project_memory SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to automatically create story transitions
CREATE TRIGGER IF NOT EXISTS track_story_status_changes
AFTER UPDATE OF status ON stories
WHEN OLD.status != NEW.status
BEGIN
  INSERT INTO story_transitions (story_id, from_status, to_status, transitioned_by_role)
  VALUES (NEW.id, OLD.status, NEW.status, COALESCE(NEW.assignee_role, 'system'));
END;

-- Trigger to update epic progress when stories change
CREATE TRIGGER IF NOT EXISTS update_epic_progress
AFTER UPDATE OF status, story_points ON stories
WHEN NEW.epic_id IS NOT NULL
BEGIN
  UPDATE epics SET 
    actual_story_points = (
      SELECT COALESCE(SUM(story_points), 0) 
      FROM stories 
      WHERE epic_id = NEW.epic_id 
      AND status = 'completed'
    )
  WHERE id = NEW.epic_id;
END;

-- Trigger to update sprint velocity
CREATE TRIGGER IF NOT EXISTS update_sprint_velocity
AFTER UPDATE OF status, story_points ON stories
WHEN NEW.sprint_id IS NOT NULL
BEGIN
  UPDATE sprints SET 
    velocity_achieved = (
      SELECT COALESCE(SUM(story_points), 0) 
      FROM stories 
      WHERE sprint_id = NEW.sprint_id 
      AND status = 'completed'
    )
  WHERE id = NEW.sprint_id;
END;

-- Trigger to update practice adoption count
CREATE TRIGGER IF NOT EXISTS update_practice_adoption_count
AFTER INSERT ON practice_adoptions
BEGIN
  UPDATE team_practices SET 
    adoption_count = (
      SELECT COUNT(*) 
      FROM practice_adoptions 
      WHERE practice_id = NEW.practice_id
    )
  WHERE id = NEW.practice_id;
END;

-- Views for common queries
CREATE VIEW IF NOT EXISTS epic_progress_view AS
SELECT 
  e.id,
  e.title,
  e.estimated_story_points,
  e.actual_story_points,
  COUNT(s.id) as total_stories,
  COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_stories,
  COALESCE(SUM(s.story_points), 0) as total_points,
  COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.story_points ELSE 0 END), 0) as completed_points,
  CASE 
    WHEN COALESCE(SUM(s.story_points), 0) = 0 THEN 0
    ELSE ROUND((COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.story_points ELSE 0 END), 0) * 100.0) / SUM(s.story_points), 2)
  END as progress_percentage
FROM epics e
LEFT JOIN stories s ON e.id = s.epic_id
GROUP BY e.id;

CREATE VIEW IF NOT EXISTS sprint_velocity_view AS
SELECT 
  sp.id,
  sp.name,
  sp.capacity_story_points,
  COUNT(s.id) as total_stories,
  COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed_stories,
  COALESCE(SUM(s.story_points), 0) as planned_points,
  COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.story_points ELSE 0 END), 0) as completed_points,
  CASE 
    WHEN COALESCE(SUM(s.story_points), 0) = 0 THEN 0
    ELSE ROUND((COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.story_points ELSE 0 END), 0) * 100.0) / SUM(s.story_points), 2)
  END as velocity_percentage
FROM sprints sp
LEFT JOIN stories s ON sp.id = s.sprint_id
GROUP BY sp.id;

CREATE VIEW IF NOT EXISTS role_memory_summary AS
SELECT 
  role,
  COUNT(*) as total_memories,
  COUNT(DISTINCT project_id) as projects_involved,
  COUNT(DISTINCT context_type) as context_types_used,
  MAX(updated_at) as last_activity
FROM role_project_memory
GROUP BY role;
`;

/**
 * Database schema for MCP Context Memory
 * Supports multi-system project tracking with repository and directory locations
 */

export const schema = `
-- Systems table to track different machines
CREATE TABLE IF NOT EXISTS systems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  hostname TEXT NOT NULL,
  platform TEXT NOT NULL,
  is_current BOOLEAN DEFAULT 0,
  metadata TEXT, -- JSON field for custom system info
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(hostname)
);

-- Projects table with repository and directory support
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  status TEXT DEFAULT 'active',
  repository_url TEXT, -- GitHub, GitLab, etc.
  local_directory TEXT, -- File system path
  primary_system_id INTEGER, -- Which system owns this project
  tags TEXT, -- JSON array of tags
  metadata TEXT, -- JSON field for custom data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (primary_system_id) REFERENCES systems(id)
);

-- Context entries for both project-specific and shared contexts
CREATE TABLE IF NOT EXISTS context_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER, -- NULL for shared context
  system_id INTEGER, -- NULL for system-agnostic entries
  type TEXT NOT NULL, -- 'decision', 'code', 'standard', 'status', etc.
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  is_system_specific BOOLEAN DEFAULT 0,
  tags TEXT, -- JSON array of tags
  metadata TEXT, -- JSON field for custom data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (system_id) REFERENCES systems(id)
);

-- Update history for audit trail
CREATE TABLE IF NOT EXISTS update_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL, -- 'project', 'context_entry', 'system'
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL, -- 'create', 'update', 'delete'
  changes TEXT, -- JSON diff of changes
  user_note TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Full-text search virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS context_search USING fts5(
  entity_id,
  entity_type,
  content,
  tags
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_system ON projects(primary_system_id);
CREATE INDEX IF NOT EXISTS idx_context_project ON context_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_context_system ON context_entries(system_id);
CREATE INDEX IF NOT EXISTS idx_context_type ON context_entries(type);
CREATE INDEX IF NOT EXISTS idx_context_key ON context_entries(key);
CREATE INDEX IF NOT EXISTS idx_history_entity ON update_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_history_timestamp ON update_history(timestamp);

-- Triggers to update timestamps
CREATE TRIGGER IF NOT EXISTS update_project_timestamp 
AFTER UPDATE ON projects
BEGIN
  UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_context_timestamp 
AFTER UPDATE ON context_entries
BEGIN
  UPDATE context_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update last_seen for systems
CREATE TRIGGER IF NOT EXISTS update_system_last_seen 
AFTER UPDATE ON systems
BEGIN
  UPDATE systems SET last_seen = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
`;

// Prepared statements for common operations
export const statements = {
  // System operations
  getCurrentSystem: 'SELECT * FROM systems WHERE is_current = 1',
  setCurrentSystem: 'UPDATE systems SET is_current = 0; UPDATE systems SET is_current = 1 WHERE id = ?',
  
  // Project operations
  getProjectByName: 'SELECT * FROM projects WHERE name = ?',
  updateProjectAccess: 'UPDATE projects SET last_accessed = CURRENT_TIMESTAMP WHERE id = ?',
  
  // Context operations
  getProjectContext: `
    SELECT ce.*, s.name as system_name 
    FROM context_entries ce
    LEFT JOIN systems s ON ce.system_id = s.id
    WHERE ce.project_id = ?
    ORDER BY ce.updated_at DESC
    LIMIT 100
  `,
  
  getSharedContext: `
    SELECT ce.*, s.name as system_name 
    FROM context_entries ce
    LEFT JOIN systems s ON ce.system_id = s.id
    WHERE ce.project_id IS NULL
  `,
  
  // Search operations
  searchByTime: `
    SELECT * FROM context_entries 
    WHERE updated_at >= datetime('now', ?)
    ORDER BY updated_at DESC
  `,
  
  // History operations
  getRecentUpdates: `
    SELECT * FROM update_history 
    WHERE timestamp >= datetime('now', ?)
    ORDER BY timestamp DESC
    LIMIT ?
  `
};

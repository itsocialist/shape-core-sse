/**
 * Type definitions for MPCM-Pro
 */

// Export role types
export * from './roles.js';

// Export service types
export * from './ServiceTypes.js';

// Export workflow types (commented out since they're in ServiceTypes now)
// export * from './WorkflowTypes.js';

// System information
export interface SystemInfo {
  name: string;
  hostname: string;
  platform: string;
  metadata?: Record<string, any>;
}

export interface System extends SystemInfo {
  id: number;
  is_current: boolean;
  created_at: string;
  last_seen: string;
}

// Project types
export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  repository_url: string | null;
  local_directory: string | null;
  primary_system_id: number | null;
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  last_accessed: string;
}

// Context entry types
export type ContextType = 
  | 'decision'      // Architectural/design decisions
  | 'code'          // Code snippets or examples
  | 'standard'      // Coding standards or conventions
  | 'status'        // Project status updates
  | 'todo'          // Tasks or action items
  | 'note'          // General notes
  | 'config'        // Configuration details
  | 'issue'         // Known issues or bugs
  | 'reference';    // External references or links

export interface ContextEntry {
  id: number;
  project_id: number | null;  // null for shared context
  system_id: number | null;    // null for system-agnostic
  type: ContextType;
  key: string;
  value: string;
  is_system_specific: boolean;
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Update history
export interface UpdateHistory {
  id: number;
  entity_type: 'project' | 'context' | 'system';
  entity_id: number;
  action: string;
  details: any; // JSON field from database
  timestamp: string;
}

// Search options
export interface SearchOptions {
  query?: string;           // Full-text search
  projectId?: number | null; // Filter by project (null for shared)
  type?: ContextType;       // Filter by type
  tags?: string[];          // Filter by tags
  since?: string;           // Time filter (e.g., '-1 day', '-1 week')
  systemSpecific?: boolean; // Filter by system-specific entries
  limit?: number;           // Result limit
}

// MCP Tool inputs (using Zod for runtime validation)
export interface StoreProjectContextInput {
  project_name: string;
  description?: string;
  status?: Project['status'];
  repository_url?: string;
  local_directory?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface StoreContextInput {
  project_name?: string;    // Omit for shared context
  type: ContextType;
  key: string;
  value: string;
  is_system_specific?: boolean;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateProjectStatusInput {
  project_name: string;
  status: Project['status'];
  note?: string;
}

export interface GetProjectContextInput {
  project_name: string;
  system_specific?: boolean;
}

export interface SearchContextInput {
  query?: string;
  project_name?: string;
  type?: ContextType;
  tags?: string[];
  since?: string;
  limit?: number;
}

export interface TagContextInput {
  context_id: number;
  add_tags?: string[];
  remove_tags?: string[];
}

// Response types
export interface ProjectSummary {
  project: Project;
  context_count: number;
  last_update: string | null;
  systems: string[];
}

export interface ContextSearchResult {
  entries: ContextEntry[];
  total_count: number;
  search_time_ms: number;
}

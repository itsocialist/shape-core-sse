/**
 * Enhanced type definitions for project management taxonomy
 * Supports: epics, sprints, stories, issues, versions, releases
 */

// Enhanced Project Metadata
export interface EnhancedProject {
  id: number;
  name: string;
  description: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  
  // Required metadata fields
  project_directory: string;          // File system path
  system_id: number;                  // System where project resides
  source_control_url: string;         // Git repository URL
  workflow_type: WorkflowType;         // Project workflow methodology
  team: ProjectTeam;                   // Role assignments
  
  // Optional metadata
  repository_url?: string;             // Legacy field for compatibility
  local_directory?: string;            // Legacy field for compatibility
  primary_system_id?: number;          // Legacy field for compatibility
  tags: string[];
  metadata: Record<string, any>;
  
  created_at: string;
  updated_at: string;
  last_accessed: string;
}

export type WorkflowType = 
  | 'agile-scrum'
  | 'agile-kanban'
  | 'waterfall'
  | 'lean'
  | 'custom';

export interface ProjectTeam {
  architect?: string;
  'product-manager'?: string;
  'tech-lead'?: string;
  'senior-developer'?: string;
  developer?: string;
  'frontend-developer'?: string;
  'backend-developer'?: string;
  'fullstack-developer'?: string;
  'devops-engineer'?: string;
  'qa-engineer'?: string;
  'security-engineer'?: string;
  designer?: string;
  [customRole: string]: string | undefined;
}

// Epic Management
export interface Epic {
  id: number;
  project_id: number;
  title: string;
  description: string;
  status: EpicStatus;
  priority: Priority;
  business_value: string;
  acceptance_criteria: string[];
  estimated_story_points: number;
  actual_story_points?: number;
  target_version?: string;
  start_date?: string;
  end_date?: string;
  assigned_to_role?: string;
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export type EpicStatus = 
  | 'planning'
  | 'ready'
  | 'in_progress'
  | 'review'
  | 'completed'
  | 'cancelled'
  | 'on_hold';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface EpicProgress {
  epic_id: number;
  total_stories: number;
  completed_stories: number;
  in_progress_stories: number;
  total_points: number;
  completed_points: number;
  progress_percentage: number;
  estimated_completion_date?: string;
}

// Sprint Management
export interface Sprint {
  id: number;
  project_id: number;
  name: string;
  start_date: string;
  end_date: string;
  capacity_story_points: number;
  sprint_goal: string;
  status: SprintStatus;
  retrospective_notes?: string;
  velocity_achieved?: number;
  burndown_data?: SprintBurndownData[];
  created_at: string;
  updated_at: string;
}

export type SprintStatus = 
  | 'planning'
  | 'active'
  | 'completed'
  | 'cancelled';

export interface SprintBurndownData {
  date: string;
  remaining_points: number;
  ideal_remaining: number;
  stories_completed: number;
}

export interface SprintVelocity {
  sprint_id: number;
  planned_points: number;
  completed_points: number;
  velocity_percentage: number;
  stories_planned: number;
  stories_completed: number;
}

// Story Management
export interface Story {
  id: number;
  epic_id?: number;
  sprint_id?: number;
  title: string;
  description: string;
  acceptance_criteria: string[];
  story_points: number;
  priority: Priority;
  status: StoryStatus;
  type: StoryType;
  assignee_role?: string;
  reviewer_role?: string;
  labels: string[];
  estimated_hours?: number;
  actual_hours?: number;
  blocked: boolean;
  blocked_reason?: string;
  dependencies: number[]; // Other story IDs
  created_at: string;
  updated_at: string;
}

export type StoryStatus = 
  | 'backlog'
  | 'ready_for_development'
  | 'in_progress'
  | 'code_review'
  | 'testing'
  | 'ready_for_deployment'
  | 'completed'
  | 'cancelled';

export type StoryType = 
  | 'feature'
  | 'bug'
  | 'technical_debt'
  | 'research'
  | 'documentation';

export interface StoryLifecycle {
  story_id: number;
  transitions: StoryTransition[];
  current_status: StoryStatus;
  total_cycle_time_hours: number;
  time_in_development_hours: number;
  time_in_review_hours: number;
  time_in_testing_hours: number;
}

export interface StoryTransition {
  id: number;
  from_status: StoryStatus | null;
  to_status: StoryStatus;
  transitioned_by_role: string;
  transition_date: string;
  notes?: string;
}

// Issue Tracking
export interface Issue {
  id: number;
  project_id: number;
  title: string;
  description: string;
  type: IssueType;
  severity: IssueSeverity;
  priority: Priority;
  status: IssueStatus;
  reporter_role: string;
  assignee_role?: string;
  reproduction_steps: string[];
  expected_behavior?: string;
  actual_behavior?: string;
  environment?: string;
  browser_version?: string;
  tags: string[];
  related_stories: number[];
  related_epics: number[];
  resolution?: string;
  resolution_date?: string;
  created_at: string;
  updated_at: string;
}

export type IssueType = 
  | 'bug'
  | 'enhancement'
  | 'task'
  | 'question'
  | 'documentation';

export type IssueSeverity = 
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'trivial';

export type IssueStatus = 
  | 'open'
  | 'in_progress'
  | 'review'
  | 'testing'
  | 'resolved'
  | 'closed'
  | 'reopened';

// Version Management
export interface ProjectVersion {
  id: number;
  project_id: number;
  version: string; // Semantic version (e.g., "1.2.3")
  type: VersionType;
  status: VersionStatus;
  changelog_summary: string;
  breaking_changes: boolean;
  target_date?: string;
  release_date?: string;
  previous_version_id?: number;
  epics: number[]; // Associated epic IDs
  created_at: string;
  updated_at: string;
}

export type VersionType = 'major' | 'minor' | 'patch' | 'hotfix';

export type VersionStatus = 
  | 'planning'
  | 'in_development'
  | 'feature_freeze'
  | 'testing'
  | 'release_candidate'
  | 'released'
  | 'deprecated';

export interface VersionProgression {
  project_id: number;
  versions: ProjectVersion[];
  current_version: string;
  latest_release: string;
  next_planned_version: string;
}

// Release Management
export interface Release {
  id: number;
  version_id: number;
  release_name: string;
  release_date: string;
  environment: ReleaseEnvironment;
  deployment_method: DeploymentMethod;
  status: ReleaseStatus;
  rollback_plan: string;
  deployment_notes: string;
  approval_required: boolean;
  approved_by_role?: string;
  approval_date?: string;
  previous_release_id?: number;
  deployment_duration_minutes?: number;
  rollback_occurred: boolean;
  rollback_reason?: string;
  created_at: string;
  updated_at: string;
}

export type ReleaseEnvironment = 
  | 'development'
  | 'testing'
  | 'staging'
  | 'production'
  | 'demo';

export type DeploymentMethod = 
  | 'manual'
  | 'automated'
  | 'blue_green'
  | 'canary'
  | 'rolling';

export type ReleaseStatus = 
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'rolled_back'
  | 'cancelled';

export interface DeploymentProgression {
  version_id: number;
  environments: {
    environment: ReleaseEnvironment;
    status: ReleaseStatus;
    release_date?: string;
  }[];
  current_environment: ReleaseEnvironment;
  next_environment?: ReleaseEnvironment;
  ready_for_production: boolean;
}

export interface ReleaseReadiness {
  version_id: number;
  ready_for_release: boolean;
  blocking_issues: string[];
  incomplete_stories: number[];
  open_critical_issues: number[];
  test_coverage_percentage: number;
  performance_benchmarks_passed: boolean;
  security_review_completed: boolean;
}

// Team Practices Memory
export interface TeamPractice {
  id: number;
  practice_name: string;
  category: PracticeCategory;
  description: string;
  implementation_details: Record<string, any>;
  success_criteria: string[];
  created_by_role: string;
  applicable_roles: string[];
  tags: string[];
  adoption_count: number;
  effectiveness_score: number;
  created_at: string;
  updated_at: string;
}

export type PracticeCategory = 
  | 'development'
  | 'testing'
  | 'deployment'
  | 'security'
  | 'performance'
  | 'documentation'
  | 'communication'
  | 'planning';

export interface PracticeAdoption {
  id: number;
  practice_id: number;
  project_id: number;
  adopted_by_role: string;
  adoption_date: string;
  customizations: string[];
  success_metrics: Record<string, number>;
  feedback: string;
  still_in_use: boolean;
}

export interface PracticeEffectiveness {
  practice_id: number;
  adoption_count: number;
  average_success_metrics: Record<string, number>;
  effectiveness_score: number;
  recommendations: string[];
}

// Role Memory Systems
export interface RoleProjectMemory {
  id: number;
  project_id: number;
  role: string;
  context_type: RoleContextType;
  context_data: Record<string, any>;
  tags: string[];
  access_level: AccessLevel;
  created_at: string;
  updated_at: string;
}

export type RoleContextType = 
  | 'architectural_decisions'
  | 'implementation_notes'
  | 'testing_strategies'
  | 'deployment_configs'
  | 'performance_insights'
  | 'security_considerations'
  | 'code_patterns'
  | 'lessons_learned'
  | 'current_work'
  | 'blockers_and_issues';

export type AccessLevel = 
  | 'public'           // Visible to all roles
  | 'project_team'     // Visible to project team members
  | 'role_specific'    // Visible only to same role
  | 'private';         // Visible only to creator

export interface RoleCrossProjectMemory {
  id: number;
  role: string;
  pattern_name: string;
  pattern_data: Record<string, any>;
  usage_count: number;
  success_rate: number;
  applicable_project_types: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface RoleSkillProgression {
  id: number;
  role: string;
  project_id: number;
  skills_demonstrated: string[];
  complexity_level: ComplexityLevel;
  success_rating: number;
  learning_outcomes: string[];
  areas_for_improvement: string[];
  recorded_date: string;
}

export type ComplexityLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

// Enhanced Search and Query Types
export interface ComplexContextQuery {
  project_id?: number;
  roles?: string[];
  context_types?: RoleContextType[];
  tags?: string[];
  date_range?: {
    start: string;
    end: string;
  };
  access_levels?: AccessLevel[];
  search_text?: string;
  limit?: number;
  offset?: number;
}

export interface ContextQueryResult {
  total_count: number;
  entries: RoleProjectMemory[];
  facets: {
    roles: string[];
    context_types: RoleContextType[];
    tags: string[];
    access_levels: AccessLevel[];
  };
  query_time_ms: number;
}

// MCP Tool Input Types
export interface StoreEnhancedProjectInput {
  name: string;
  description?: string;
  project_directory: string;
  system_id?: number;
  source_control_url: string;
  workflow_type: WorkflowType;
  team: ProjectTeam;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface CreateEpicInput {
  project_id: number;
  title: string;
  description: string;
  business_value: string;
  acceptance_criteria: string[];
  estimated_story_points: number;
  target_version?: string;
  priority?: Priority;
  assigned_to_role?: string;
  tags?: string[];
}

export interface CreateSprintInput {
  project_id: number;
  name: string;
  start_date: string;
  end_date: string;
  capacity_story_points: number;
  sprint_goal: string;
}

export interface CreateStoryInput {
  epic_id?: number;
  sprint_id?: number;
  title: string;
  description: string;
  acceptance_criteria: string[];
  story_points: number;
  priority?: Priority;
  type?: StoryType;
  assignee_role?: string;
  labels?: string[];
}

export interface CreateIssueInput {
  project_id: number;
  title: string;
  description: string;
  type: IssueType;
  severity: IssueSeverity;
  priority: Priority;
  reporter_role: string;
  assignee_role?: string;
  reproduction_steps: string[];
  tags?: string[];
}

export interface CreateVersionInput {
  project_id: number;
  version: string;
  type: VersionType;
  changelog_summary: string;
  breaking_changes: boolean;
  target_date?: string;
}

export interface CreateReleaseInput {
  version_id: number;
  release_name: string;
  release_date: string;
  environment: ReleaseEnvironment;
  deployment_method: DeploymentMethod;
  rollback_plan: string;
  deployment_notes: string;
  approval_required?: boolean;
  approved_by_role?: string;
}

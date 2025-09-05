// Role-related type definitions

// Re-declare ContextType to avoid circular dependency
export type ContextType = 
  | 'decision'      
  | 'code'          
  | 'standard'      
  | 'status'        
  | 'todo'          
  | 'note'          
  | 'config'        
  | 'issue'         
  | 'reference';

export interface Role {
  id: string;
  name: string;
  description: string;
  isCustom: boolean;
  templateConfig: RoleTemplateConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleTemplateConfig {
  focusAreas: string[];
  defaultTags: string[];
  contextTypes: ContextType[];
}

export interface ProjectRole {
  projectId: string;
  roleId: string;
  isActive: boolean;
  customConfig?: Record<string, any>;
  createdAt: Date;
}

export interface RoleHandoff {
  id: string;
  projectId: string;
  fromRoleId: string;
  toRoleId: string;
  handoffData: HandoffData;
  createdAt: Date;
  createdBySystemId?: string;
}

export interface HandoffData {
  summary: string;
  keyDecisions: string[];
  pendingTasks: string[];
  warnings?: string[];
  context?: Record<string, any>;
}

export interface ActiveRole {
  projectId: string;
  systemId: string;
  roleId: string;
  activatedAt: Date;
}

// Base interfaces to avoid circular dependencies
export interface BaseContextEntry {
  id: number;
  project_id: number | null;
  system_id: number | null;
  type: ContextType;
  key: string;
  value: string;
  is_system_specific: boolean;
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface BaseSearchParams {
  query?: string;
  projectId?: number | null;
  type?: ContextType;
  tags?: string[];
  since?: string;
  systemSpecific?: boolean;
  limit?: number;
}

// Extended context entry with role
export interface RoleContextEntry extends BaseContextEntry {
  roleId?: string;
  roleName?: string;
}

// Role-specific search parameters
export interface RoleSearchParams extends BaseSearchParams {
  roleId?: string;
  crossRole?: boolean;
  includeHandoffs?: boolean;
}

// Default role IDs
export const DEFAULT_ROLE_IDS = {
  ARCHITECT: 'architect',
  DEVELOPER: 'developer',
  DEVOPS: 'devops',
  QA: 'qa',
  PRODUCT: 'product'
} as const;

export type DefaultRoleId = typeof DEFAULT_ROLE_IDS[keyof typeof DEFAULT_ROLE_IDS];

// Role context for service operations
export interface RoleContext {
  role: string;
  projectId: string;
  context: Record<string, any>;
  preferences?: Record<string, any>;
  capabilities?: string[];
}

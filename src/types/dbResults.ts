/**
 * Database query result types for role operations
 */

// Database result types
export interface ProjectResult {
  id: number;
  name?: string;
  description?: string;
}

export interface RoleResult {
  id: string;
  name: string;
  description: string;
  is_custom: number;
  template_config: string;
  created_at?: string;
  updated_at?: string;
}

export interface ActiveRoleResult {
  role_id: string;
  activated_at?: string;
}

export interface ProjectRoleResult {
  is_active: number;
}

export interface SystemResult {
  id: number;
  name: string;
}

export interface ContextResult {
  id: number;
  key?: string;
  type?: string;
  count?: number;
}

export interface UpdateResult {
  last_update: string;
}

// Type guards
export function isProjectResult(obj: any): obj is ProjectResult {
  return obj && typeof obj.id === 'number';
}

export function isRoleResult(obj: any): obj is RoleResult {
  return obj && typeof obj.id === 'string' && typeof obj.name === 'string';
}

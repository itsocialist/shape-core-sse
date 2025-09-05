/**
 * Desktop Integration Types
 * 
 * Types for Claude Desktop configuration, shape-desktop app integration,
 * and UI optimization features
 */

export interface ClaudeDesktopConfig {
  mcpServers: {
    [serverName: string]: {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    };
  };
  version: string;
  description?: string;
}

export interface ToolCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  tools: string[]; // tool names
}

export interface UIOptimizedSchema {
  type: string;
  properties: {
    [key: string]: UIOptimizedProperty;
  };
  required?: string[];
  uiMetadata?: {
    formLayout?: 'vertical' | 'horizontal' | 'grid';
    sections?: UISection[];
    fieldOrder?: string[];
  };
}

export interface UIOptimizedProperty {
  type: string;
  description?: string;
  enum?: any[];
  default?: any;
  uiHints?: {
    widget?: 'text' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'slider';
    placeholder?: string;
    helpText?: string;
    validation?: {
      pattern?: string;
      minLength?: number;
      maxLength?: number;
    };
  };
}

export interface UISection {
  title: string;
  fields: string[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export interface ToolUsageAnalytics {
  toolName: string;
  usageCount: number;
  lastUsed?: Date;
  averageExecutionTime?: number;
  successRate?: number;
  userFeedback?: {
    rating: number;
    comments: string[];
  };
}

export interface DesktopAppStatus {
  connected: boolean;
  version?: string;
  lastSeen?: Date;
  activeProject?: string;
  capabilities: string[];
}

export interface IPCMessage {
  id: string;
  type: 'request' | 'response' | 'event';
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

export interface ProjectSyncData {
  projectId: string;
  name: string;
  lastModified: Date;
  status: string;
  context: {
    entries: number;
    lastEntry?: Date;
  };
}

export interface RoleToolSubset {
  role: string;
  tools: {
    primary: string[];    // Most frequently used
    secondary: string[];  // Sometimes used
    advanced: string[];   // Rarely used but available
  };
  categories: string[];   // Which tool categories this role uses
}

export interface BatchToolCall {
  id: string;
  name: string;
  arguments: any;
}

export interface BatchToolResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

export interface StreamProgress {
  operationId: string;
  phase: string;
  progress: number; // 0-100
  message: string;
  details?: any;
}

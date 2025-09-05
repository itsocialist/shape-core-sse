/**
 * TypeScript-Rust Interface Types
 * Based on docs/typescript-rust-interface.md
 */

export interface ServiceRequest {
  id: string;          // Unique request ID
  method: string;      // Method name
  params: any;         // Method parameters
}

export interface ServiceResponse {
  id: string;          // Matching request ID
  result?: any;        // Success result
  error?: {
    code: number;      // Error code
    message: string;   // Error message
  };
}

export interface UnixSocketClientOptions {
  timeout?: number;           // Request timeout in ms (default: 30000)
  autoReconnect?: boolean;    // Auto-reconnect on connection loss (default: true)
  reconnectDelay?: number;    // Delay between reconnection attempts in ms (default: 1000)
  maxReconnectAttempts?: number; // Maximum reconnection attempts (default: 5)
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  evictions: number;
}

export interface CacheOptions {
  maxSize: number;    // Maximum number of entries
  ttl: number;        // Time to live in milliseconds
}

// MCP Context Types (matching our existing implementation)
export type ContextType = 'decision' | 'code' | 'standard' | 'status' | 'todo' | 'note' | 'config' | 'issue' | 'reference';

export interface ContextEntry {
  id: string;
  project_name: string;
  key: string;
  type: ContextType;
  value: string;
  tags: string[];
  metadata?: Record<string, any>;
  role_id?: string;
  system_id?: string;
  is_system_specific?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  repository_url?: string;
  local_directory?: string;
  tags: string[];
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
  accessed_at: string;
}

// Error codes from the specification
export enum ErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  CONTEXT_NOT_FOUND = 1001,
  PROJECT_NOT_FOUND = 1002,
  DATABASE_ERROR = 1003,
}

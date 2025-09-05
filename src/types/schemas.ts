/**
 * Zod schemas for input validation
 */

import { z } from 'zod';
import type { ContextType } from './index.js';

// Valid context types
const contextTypes: ContextType[] = [
  'decision', 'code', 'standard', 'status', 
  'todo', 'note', 'config', 'issue', 'reference'
];

// Export context type schema for reuse
export const contextTypeSchema = z.enum(contextTypes as [ContextType, ...ContextType[]]);

// Project status enum
const projectStatus = z.enum(['active', 'paused', 'completed', 'archived']);

// Base schemas
export const storeProjectContextSchema = z.object({
  project_name: z.string().min(1).max(255),
  description: z.string().optional(),
  status: projectStatus.optional(),
  repository_url: z.string().url().optional().or(z.literal('')),
  local_directory: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

export const storeContextSchema = z.object({
  project_name: z.string().optional(),
  type: z.enum(contextTypes as [ContextType, ...ContextType[]]),
  key: z.string().min(1).max(255),
  value: z.string().min(1),
  is_system_specific: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional()
});

export const updateProjectStatusSchema = z.object({
  project_name: z.string().min(1),
  status: projectStatus,
  note: z.string().optional()
});

export const getProjectContextSchema = z.object({
  project_name: z.string().min(1),
  system_specific: z.boolean().optional().default(false)
});

export const searchContextSchema = z.object({
  query: z.string().optional(),
  project_name: z.string().optional(),
  type: z.enum(contextTypes as [ContextType, ...ContextType[]]).optional(),
  tags: z.array(z.string()).optional(),
  since: z.string().optional(), // e.g., '-1 day', '-1 week'
  limit: z.number().int().positive().max(100).optional().default(20)
});

export const tagContextSchema = z.object({
  context_id: z.number().int().positive(),
  add_tags: z.array(z.string()).optional(),
  remove_tags: z.array(z.string()).optional()
});

export const listProjectsSchema = z.object({
  include_archived: z.boolean().optional().default(false)
});

export const getRecentUpdatesSchema = z.object({
  since: z.string().optional().default('-1 day'),
  limit: z.number().int().positive().max(100).optional().default(50)
});

export const archiveProjectSchema = z.object({
  project_name: z.string().min(1),
  archive_contexts: z.boolean().optional().default(false)
});

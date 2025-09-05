/**
 * MCP Tool: Store Project Context
 * Creates or updates a project with its metadata
 * Now with security validation for paths and URLs
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { DatabaseManager } from '../db/database.js';
import { storeProjectContextSchema } from '../types/schemas.js';
import type { StoreProjectContextInput } from '../types/index.js';
import { validatePath, validateRepositoryUrl } from '../utils/security.js';
import { ValidationError, withErrorHandling } from '../utils/errors.js';
import { validateTags, validateMetadata } from '../utils/jsonValidation.js';

export function createStoreProjectContextTool(db: DatabaseManager): Tool {
  return {
    name: 'store_project_context',
    description: 'Store or update project information including repository URL and metadata',
    
    inputSchema: {
      type: 'object',
      properties: {
        project_name: {
          type: 'string',
          description: 'Unique name for the project'
        },
        description: {
          type: 'string',
          description: 'Project description or purpose'
        },
        status: {
          type: 'string',
          enum: ['active', 'paused', 'completed', 'archived'],
          description: 'Current project status'
        },
        repository_url: {
          type: 'string',
          description: 'Git repository URL (GitHub, GitLab, etc.)'
        },
        local_directory: {
          type: 'string',
          description: 'Local file system path to project'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization'
        },
        metadata: {
          type: 'object',
          description: 'Additional custom metadata'
        }
      },
      required: ['project_name']
    }
  };
}

export const handleStoreProjectContext = withErrorHandling(async (
  db: DatabaseManager, 
  input: unknown
): Promise<string> => {
  // Validate input with Zod schema
  const validated = storeProjectContextSchema.parse(input) as StoreProjectContextInput;
  
  // Validate and sanitize paths and URLs
  let sanitizedLocalDirectory: string | null = null;
  let sanitizedRepositoryUrl: string | null = null;
  let validatedTags: string[] | undefined;
  let validatedMetadata: Record<string, any> | undefined;
  
  try {
    // Validate local directory path if provided
    if (validated.local_directory) {
      sanitizedLocalDirectory = validatePath(validated.local_directory);
      if (!sanitizedLocalDirectory) {
        throw new ValidationError(
          'Invalid local directory path',
          'The provided local directory path is invalid'
        );
      }
    }
    
    // Validate repository URL if provided
    if (validated.repository_url) {
      sanitizedRepositoryUrl = validateRepositoryUrl(validated.repository_url);
      if (!sanitizedRepositoryUrl) {
        throw new ValidationError(
          'Invalid repository URL',
          'The provided repository URL is invalid'
        );
      }
    }
    
    // Validate tags if provided
    validatedTags = validated.tags ? validateTags(validated.tags) : undefined;
    
    // Validate metadata if provided
    validatedMetadata = validated.metadata ? validateMetadata(validated.metadata) : undefined;
    
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      (error as Error).message || 'Validation failed',
      'Invalid input provided'
    );
  }
  
  // Store the project with validated data
  const project = db.upsertProject({
    name: validated.project_name,
    description: validated.description,
    status: validated.status,
    repository_url: sanitizedRepositoryUrl,
    local_directory: sanitizedLocalDirectory,
    tags: validatedTags,
    metadata: validatedMetadata
  });
  
  // Build response message
  const parts = [`✅ Project '${project.name}' updated successfully.`];
  
  if (project.repository_url) {
    parts.push(`📦 Repository: ${project.repository_url}`);
  }
  if (project.local_directory) {
    parts.push(`📁 Local directory: ${project.local_directory}`);
  }
  if (project.status) {
    parts.push(`📊 Status: ${project.status}`);
  }
  if (project.tags && Array.isArray(project.tags) && project.tags.length > 0) {
    parts.push(`🏷️  Tags: ${project.tags.join(', ')}`);
  }
  
  const currentSystem = db.getCurrentSystem();
  if (currentSystem) {
    parts.push(`💻 Primary system: ${currentSystem.name}`);
  }
  
  return parts.join('\n');
});

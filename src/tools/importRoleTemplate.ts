/**
 * MCP Tool: Import Role Template
 * Allows users to import role templates from JSON
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { getDatabase } from '../db/helpers.js';
import { getCurrentSystemId } from '../db/helpers.js';
import { RoleValidator } from '../utils/roleValidator.js';
import { ApplicationError, ERROR_CODES } from '../utils/errors.js';
import { createCustomRole } from './createCustomRole.js';

const inputSchema = z.object({
  template_json: z.string(),
  role_id: z.string().min(1).max(50).optional()
});

export const importRoleTemplateTool: Tool = {
  name: 'import_role_template',
  description: 'Import a role template from JSON format',
  
  inputSchema: {
    type: 'object',
    properties: {
      template_json: {
        type: 'string',
        description: 'JSON string containing the role template'
      },
      role_id: {
        type: 'string',
        description: 'Optional: Override the ID in the template'
      }
    },
    required: ['template_json']
  }
};

export async function importRoleTemplate(input: unknown) {
  const validated = inputSchema.parse(input);
  const db = await getDatabase();
  const systemId = await getCurrentSystemId(db);
  
  // Parse the JSON template
  let template: any;
  try {
    template = JSON.parse(validated.template_json);
  } catch (error) {
    throw new ApplicationError(
      'Invalid JSON format in template',
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  
  // Override ID if provided
  if (validated.role_id) {
    template.id = validated.role_id;
  }
  
  // Validate the template
  const validationResult = RoleValidator.validateRoleTemplate(template);
  if (!validationResult.valid) {
    throw new ApplicationError(
      `Invalid role template: ${validationResult.errors.join(', ')}`,
      ERROR_CODES.VALIDATION_ERROR
    );
  }
  
  const validatedTemplate = validationResult.sanitized!;
  
  // Check if this might be from the future marketplace
  const isFromMarketplace = template.source === 'marketplace' || template.downloads !== undefined;
  
  try {
    // Use the createCustomRole function to actually create the role
    const result = await createCustomRole({
      id: validatedTemplate.id,
      name: validatedTemplate.name,
      description: validatedTemplate.description,
      base_role_id: validatedTemplate.base_role_id,
      focus_areas: validatedTemplate.focus_areas,
      default_tags: validatedTemplate.default_tags,
      preferred_context_types: validatedTemplate.preferred_context_types
    });
    
    // If this template is from marketplace (future feature), record it
    if (isFromMarketplace && template.template_id) {
      try {
        db.prepare(`
          INSERT INTO role_templates (id, name, description, base_config, author, downloads)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET downloads = downloads + 1
        `).run(
          template.template_id,
          validatedTemplate.name,
          validatedTemplate.description,
          JSON.stringify(validatedTemplate),
          template.author || 'unknown',
          1
        );
      } catch (e) {
        // Ignore errors - marketplace tracking is optional
      }
    }
    
    // Add import source info to the response
    let importInfo = '\n\n📥 Import Details:\n';
    if (validated.role_id) {
      importInfo += `   • ID overridden to: ${validated.role_id}\n`;
    }
    if (isFromMarketplace) {
      importInfo += `   • Source: Role Template Marketplace\n`;
      if (template.author) {
        importInfo += `   • Author: ${template.author}\n`;
      }
    } else {
      importInfo += `   • Source: Custom JSON template\n`;
    }
    
    return result + importInfo;
    
  } catch (error) {
    // If it's already an ApplicationError, re-throw it
    if (error instanceof ApplicationError) {
      throw error;
    }
    // Otherwise wrap it
    throw new ApplicationError(
      `Failed to import role template: ${(error as Error).message}`,
      ERROR_CODES.DATABASE_ERROR
    );
  }
}

// Example templates for documentation
export const exampleTemplates = {
  securityEngineer: {
    id: "security-engineer",
    name: "Security Engineer",
    description: "Focuses on security architecture, threat modeling, and compliance",
    base_role_id: "architect",
    focus_areas: ["security", "threats", "vulnerabilities", "compliance", "encryption"],
    default_tags: ["security", "threat", "vulnerability", "compliance"],
    preferred_context_types: ["issue", "decision", "standard", "config"]
  },
  
  technicalWriter: {
    id: "technical-writer",
    name: "Technical Writer",
    description: "Creates and maintains documentation, guides, and technical content",
    base_role_id: "developer",
    focus_areas: ["documentation", "guides", "tutorials", "api-docs", "user-experience"],
    default_tags: ["documentation", "guide", "tutorial"],
    preferred_context_types: ["note", "reference", "standard", "todo"]
  },
  
  dataEngineer: {
    id: "data-engineer",
    name: "Data Engineer",
    description: "Designs and maintains data pipelines, ETL processes, and data infrastructure",
    base_role_id: "developer",
    focus_areas: ["data-pipelines", "etl", "data-quality", "schemas", "analytics"],
    default_tags: ["data", "pipeline", "etl", "analytics"],
    preferred_context_types: ["code", "config", "decision", "issue"]
  }
};

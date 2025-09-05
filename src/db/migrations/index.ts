/**
 * Migration index
 * Exports all migrations in order
 */

import { migration001_initial_schema } from './001_initial_schema.js';
import { migration_002_roles } from './002_roles.js';
import { migration_003_custom_roles } from './003_custom_roles.js';
import { migration004 } from './004_enhanced_project_management.js';
import { migration005 } from './005_fix_missing_system_id.js';
// Removed soft delete migration - using hard deletes instead
import type { Migration } from './migrationManager.js';

export const migrations: Migration[] = [
  migration001_initial_schema,
  migration_002_roles,
  migration_003_custom_roles,
  migration004,
  migration005,
  // Add new migrations here in order
];

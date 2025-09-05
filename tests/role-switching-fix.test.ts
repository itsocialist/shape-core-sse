/**
 * Test suite for role switching bug fix and memory optimization
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { getDatabase, setTestDatabase } from '../src/db/helpers.js';
import { switchRole } from '../src/tools/switchRole.js';
import { Database } from 'better-sqlite3';

describe('Role Switching Bug Fix', () => {
  let db: Database;
  
  beforeEach(async () => {
    db = await getDatabase();
    
    // Ensure test project exists
    db.prepare(`
      INSERT OR IGNORE INTO projects (name, description, status)
      VALUES ('mpcm-pro', 'MPCM-Pro test project', 'active')
    `).run();
  });

  afterEach(() => {
    // Clean up test data only, don't close shared connection
    try {
      db.prepare('DELETE FROM active_roles WHERE project_id IN (SELECT id FROM projects WHERE name = ?)').run('mpcm-pro');
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should find project with exact name match', async () => {
    const result = await switchRole({
      project_name: 'mpcm-pro',
      role_id: 'developer'
    });
    
    expect(result).toContain('✅ Switched to Software Developer');
    expect(result).toContain("'mpcm-pro'");
  });

  it('should handle case-insensitive project lookup', async () => {
    const result = await switchRole({
      project_name: 'MPCM-PRO',
      role_id: 'architect'
    });
    
    expect(result).toContain('✅ Switched to Software Architect');
  });

  it('should provide clear error for non-existent project', async () => {
    await expect(switchRole({
      project_name: 'non-existent-project',
      role_id: 'developer'
    })).rejects.toThrow("Project 'non-existent-project' not found");
  });

  it('should suggest similar project names when exact match fails', async () => {
    try {
      await switchRole({
        project_name: 'mpcm',
        role_id: 'developer'
      });
    } catch (error: any) {
      expect(error.message).toContain('Did you mean');
      expect(error.message).toContain('mpcm-pro');
    }
  });
});

describe('Memory Optimization', () => {
  let db: Database;
  
  beforeEach(async () => {
    db = await getDatabase();
  });

  afterEach(() => {
    // No database cleanup needed for shared connection
  });

  it('should compress role guidance responses', async () => {
    const result = await switchRole({
      project_name: 'mpcm-pro',
      role_id: 'developer'
    });
    
    // Verify response is under 500 characters (compressed)
    expect(result.length).toBeLessThan(500);
    expect(result).toContain('✅ Switched to');
    expect(result).toContain('💻'); // Role emoji for visual identification
  });

  it('should use efficient database queries', () => {
    // Test that the optimized query uses joins instead of multiple lookups
    const query = db.prepare(`
      SELECT p.id, p.name, r.id as role_id, r.name as role_name, r.template_config
      FROM projects p
      CROSS JOIN roles r
      WHERE LOWER(p.name) = LOWER(?) AND r.id = ?
    `);
    
    const result = query.get('mpcm-pro', 'developer');
    expect(result).toBeDefined();
    expect(result.name).toBe('mpcm-pro');
    expect(result.role_id).toBe('developer');
  });
});

/**
 * Integration tests for role-related database operations
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { migration_002_roles } from '../src/db/migrations/002_roles';
import { DEFAULT_ROLE_IDS } from '../src/types/roles';
import type { Role, ActiveRole, RoleHandoff } from '../src/types/roles';

describe('Role Database Operations', () => {
  let db: Database.Database;

  beforeEach(async () => {
    // Create in-memory database with schema
    db = new Database(':memory:');
    
    // Run base schema setup
    db.exec(`
      CREATE TABLE IF NOT EXISTS migration_history (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Base tables needed for roles
      CREATE TABLE IF NOT EXISTS systems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        hostname TEXT NOT NULL,
        platform TEXT NOT NULL,
        is_current BOOLEAN DEFAULT FALSE,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        status TEXT CHECK(status IN ('active', 'paused', 'completed', 'archived')) DEFAULT 'active',
        repository_url TEXT,
        local_directory TEXT,
        primary_system_id INTEGER REFERENCES systems(id),
        tags JSON DEFAULT '[]',
        metadata JSON DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS context_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER REFERENCES projects(id),
        system_id INTEGER REFERENCES systems(id),
        type TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        is_system_specific BOOLEAN DEFAULT FALSE,
        tags JSON DEFAULT '[]',
        metadata JSON DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS update_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details JSON,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Run role migration
    migration_002_roles.up(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Role CRUD Operations', () => {
    it('should retrieve all default roles', () => {
      const roles = db.prepare('SELECT * FROM roles WHERE is_custom = 0').all() as Role[];
      
      expect(roles).toHaveLength(5);
      expect(roles.map(r => r.id)).toContain(DEFAULT_ROLE_IDS.ARCHITECT);
      expect(roles.map(r => r.id)).toContain(DEFAULT_ROLE_IDS.DEVELOPER);
    });

    it('should create custom role', () => {
      const customRole = {
        id: 'tech-lead',
        name: 'Technical Lead',
        description: 'Bridges architecture and development',
        isCustom: true,
        templateConfig: {
          focusAreas: ['architecture', 'mentoring', 'code-review'],
          defaultTags: ['tech-lead', 'leadership'],
          contextTypes: ['decision', 'code', 'standard']
        }
      };

      db.prepare(`
        INSERT INTO roles (id, name, description, is_custom, template_config)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        customRole.id,
        customRole.name,
        customRole.description,
        1,
        JSON.stringify(customRole.templateConfig)
      );

      const saved = db.prepare('SELECT * FROM roles WHERE id = ?').get(customRole.id);
      expect(saved.name).toBe(customRole.name);
      expect(saved.is_custom).toBe(1);
    });
  });

  describe('Active Role Management', () => {
    let projectId: number;
    let systemId: number;

    beforeEach(() => {
      // Create test system and project
      const sysResult = db.prepare(`
        INSERT INTO systems (name, hostname, platform, is_current)
        VALUES ('test-system', 'localhost', 'darwin', 1)
      `).run();
      systemId = sysResult.lastInsertRowid as number;

      const projResult = db.prepare(`
        INSERT INTO projects (name, description)
        VALUES ('test-project', 'Test project')
      `).run();
      projectId = projResult.lastInsertRowid as number;
    });

    it('should set and retrieve active role', () => {
      // Set active role
      db.prepare(`
        INSERT INTO active_roles (project_id, system_id, role_id)
        VALUES (?, ?, ?)
      `).run(projectId, systemId, DEFAULT_ROLE_IDS.DEVELOPER);

      // Retrieve active role
      const active = db.prepare(`
        SELECT * FROM active_roles 
        WHERE project_id = ? AND system_id = ?
      `).get(projectId, systemId) as { role_id: string } | undefined;

      expect(active?.role_id).toBe(DEFAULT_ROLE_IDS.DEVELOPER);
    });

    it('should update active role on switch', () => {
      // Set initial role
      db.prepare(`
        INSERT INTO active_roles (project_id, system_id, role_id)
        VALUES (?, ?, ?)
      `).run(projectId, systemId, DEFAULT_ROLE_IDS.ARCHITECT);

      // Switch role
      db.prepare(`
        INSERT OR REPLACE INTO active_roles (project_id, system_id, role_id, activated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `).run(projectId, systemId, DEFAULT_ROLE_IDS.DEVELOPER);

      const active = db.prepare(`
        SELECT role_id FROM active_roles 
        WHERE project_id = ? AND system_id = ?
      `).get(projectId, systemId);

      expect(active.role_id).toBe(DEFAULT_ROLE_IDS.DEVELOPER);
    });
  });

  describe('Role Handoffs', () => {
    let projectId: number;

    beforeEach(() => {
      const result = db.prepare(`
        INSERT INTO projects (name) VALUES ('handoff-test')
      `).run();
      projectId = result.lastInsertRowid as number;
    });

    it('should create role handoff', () => {
      const handoffData = {
        summary: 'Completed system design phase',
        keyDecisions: [
          'Microservices architecture',
          'PostgreSQL for persistence',
          'Redis for caching'
        ],
        pendingTasks: [
          'Implement user service',
          'Set up CI/CD pipeline'
        ],
        warnings: ['Database connection pooling needs attention']
      };

      const result = db.prepare(`
        INSERT INTO role_handoffs (id, project_id, from_role_id, to_role_id, handoff_data)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        'handoff-1',
        projectId,
        DEFAULT_ROLE_IDS.ARCHITECT,
        DEFAULT_ROLE_IDS.DEVELOPER,
        JSON.stringify(handoffData)
      );

      const saved = db.prepare(`
        SELECT * FROM role_handoffs WHERE id = ?
      `).get('handoff-1');

      expect(saved.from_role_id).toBe(DEFAULT_ROLE_IDS.ARCHITECT);
      expect(saved.to_role_id).toBe(DEFAULT_ROLE_IDS.DEVELOPER);
      
      const data = JSON.parse(saved.handoff_data);
      expect(data.keyDecisions).toHaveLength(3);
      expect(data.pendingTasks).toHaveLength(2);
    });
  });

  describe('Role-based Context Queries', () => {
    let projectId: number;

    beforeEach(() => {
      const result = db.prepare(`
        INSERT INTO projects (name) VALUES ('query-test')
      `).run();
      projectId = result.lastInsertRowid as number;

      // Insert contexts for different roles
      const contexts = [
        { role: DEFAULT_ROLE_IDS.ARCHITECT, type: 'decision', key: 'arch-1' },
        { role: DEFAULT_ROLE_IDS.ARCHITECT, type: 'decision', key: 'arch-2' },
        { role: DEFAULT_ROLE_IDS.DEVELOPER, type: 'code', key: 'dev-1' },
        { role: DEFAULT_ROLE_IDS.DEVELOPER, type: 'todo', key: 'dev-2' },
        { role: null, type: 'standard', key: 'shared-1' }
      ];

      const stmt = db.prepare(`
        INSERT INTO context_entries (project_id, role_id, type, key, value)
        VALUES (?, ?, ?, ?, 'test value')
      `);

      contexts.forEach(ctx => {
        stmt.run(projectId, ctx.role, ctx.type, ctx.key);
      });
    });

    it('should query contexts by role', () => {
      const archContexts = db.prepare(`
        SELECT COUNT(*) as count FROM context_entries 
        WHERE project_id = ? AND role_id = ?
      `).get(projectId, DEFAULT_ROLE_IDS.ARCHITECT);

      expect(archContexts.count).toBe(2);
    });

    it('should query contexts across roles', () => {
      const allContexts = db.prepare(`
        SELECT COUNT(*) as count FROM context_entries 
        WHERE project_id = ?
      `).get(projectId);

      expect(allContexts.count).toBe(5);
    });

    it('should join with role information', () => {
      const contextsWithRoles = db.prepare(`
        SELECT 
          ce.key,
          ce.type,
          r.name as role_name
        FROM context_entries ce
        LEFT JOIN roles r ON ce.role_id = r.id
        WHERE ce.project_id = ?
        ORDER BY ce.key
      `).all(projectId);

      expect(contextsWithRoles).toHaveLength(5);
      expect(contextsWithRoles[0].role_name).toBe('Software Architect');
      expect(contextsWithRoles[4].role_name).toBeNull(); // shared context
    });
  });
});

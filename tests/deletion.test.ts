/**
 * Tests for hard deletion functionality
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DatabaseManager } from '../src/db/database.js';
import { deleteProject } from '../src/tools/deleteProject';
import { deleteContext } from '../src/tools/deleteContext';
import { cleanupOldData } from '../src/tools/cleanupOldData';
import { join, dirname } from 'path';
import { rmSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Mock the database helpers to use our test database
let testDb: DatabaseManager;
jest.mock('../src/db/helpers', () => ({
  getDatabase: async () => (testDb as any).db,
  getCurrentSystemId: async () => 1
}));

describe('Hard Deletion Features', () => {
  let db: DatabaseManager;
  let testDbPath: string;

  beforeEach(async () => {
    testDbPath = join(__dirname, `test-deletion-${Date.now()}.db`);
    try {
      rmSync(testDbPath, { force: true });
      rmSync(testDbPath + '-shm', { force: true });
      rmSync(testDbPath + '-wal', { force: true });
    } catch (e) {
      // Ignore errors if files don't exist
    }
    
    db = await DatabaseManager.create(testDbPath);
    testDb = db; // Set the global for the mock
  });

  afterEach(() => {
    try {
      db.close();
      rmSync(testDbPath, { force: true });
      rmSync(testDbPath + '-shm', { force: true });
      rmSync(testDbPath + '-wal', { force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Delete Project', () => {
    it('should permanently delete a project', async () => {
      // Create a test project
      const project = db.upsertProject({
        name: 'test-delete-project',
        description: 'Test project for deletion',
        status: 'active'
      });

      // Delete the project
      const result = await deleteProject(db, {
        project_name: 'test-delete-project',
        confirm: true
      });

      expect(result).toContain('permanently deleted');
      
      // Verify project is gone
      const projects = db.listProjects();
      expect(projects.find(p => p.name === 'test-delete-project')).toBeUndefined();
    });

    it('should require confirmation', async () => {
      await expect(deleteProject(db, {
        project_name: 'test-project',
        confirm: false
      })).rejects.toThrow('confirmation required');
    });
  });

  describe('Delete Context', () => {
    it('should permanently delete a context', async () => {
      // Create project and context
      const project = db.upsertProject({
        name: 'test-project',
        description: 'Test project',
        status: 'active'
      });

      db.storeContext({
        project_id: project.id,
        key: 'test-context',
        type: 'note',
        value: 'Test value',
        tags: ['test']
      });

      // Delete the context
      const result = await deleteContext(db, {
        context_key: 'test-context',
        project_name: 'test-project'
      });

      expect(result).toContain('permanently deleted');
      
      // Verify context is gone
      const contexts = db.getProjectContext(project.id);
      expect(contexts.find(c => c.key === 'test-context')).toBeUndefined();
    });
  });

  describe('Cleanup Old Data', () => {
    it('should identify old data for cleanup', async () => {
      const result = await cleanupOldData(db, {
        older_than: '1 year',
        dry_run: true
      });

      expect(result).toContain('Cleanup Report (Dry Run)');
    });
  });
});

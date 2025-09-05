/**
 * Basic tests for database functionality
 */

import { DatabaseManager } from '../src/db/database';
import { join, dirname } from 'path';
import { rmSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('DatabaseManager', () => {
  let db: DatabaseManager;
  let testDbPath: string;

  beforeEach(async () => {
    // Clean up any existing test database
    testDbPath = join(__dirname, `test-${Date.now()}.db`);
    try {
      rmSync(testDbPath, { force: true });
      rmSync(testDbPath + '-shm', { force: true });
      rmSync(testDbPath + '-wal', { force: true });
    } catch (e) {
      // Ignore errors if files don't exist
    }
    
    db = await DatabaseManager.create(testDbPath);
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    // Clean up test database
    try {
      rmSync(testDbPath, { force: true });
      rmSync(testDbPath + '-shm', { force: true });
      rmSync(testDbPath + '-wal', { force: true });
    } catch (e) {
      // Ignore errors
    }
  });

  test('should initialize with current system', () => {
    const system = db.getCurrentSystem();
    expect(system).toBeTruthy();
    expect(system?.is_current).toBe(1); // SQLite stores booleans as 0/1
    expect(system?.hostname).toBeTruthy();
  });

  test('should create and retrieve a project', () => {
    const project = db.upsertProject({
      name: 'test-project',
      description: 'A test project',
      repository_url: 'https://github.com/test/repo',
      local_directory: '/path/to/project',
      tags: ['test', 'sample']
    });

    expect(project.name).toBe('test-project');
    expect(project.description).toBe('A test project');
    expect(project.repository_url).toBe('https://github.com/test/repo');
    expect(project.tags).toEqual(['test', 'sample']);

    // Retrieve the project
    const retrieved = db.getProject('test-project');
    expect(retrieved).toBeTruthy();
    expect(retrieved?.name).toBe('test-project');
  });

  test('should store and retrieve context entries', () => {
    // Create a project first
    const project = db.upsertProject({ name: 'test-project' });

    // Store context
    const context = db.storeContext({
      project_id: project.id,
      type: 'decision',
      key: 'Database Choice',
      value: 'We chose PostgreSQL for JSON support',
      tags: ['database', 'architecture']
    });

    expect(context.key).toBe('Database Choice');
    expect(context.type).toBe('decision');

    // Retrieve project context
    const entries = db.getProjectContext(project.id);
    expect(entries.length).toBe(1);
    expect(entries[0].key).toBe('Database Choice');
  });

  test('should store shared context', () => {
    const context = db.storeContext({
      project_id: null,
      type: 'standard',
      key: 'TypeScript Config',
      value: 'Always use strict mode',
      tags: ['typescript', 'standard']
    });

    expect(context.project_id).toBeNull();

    // Retrieve shared context
    const shared = db.getSharedContext();
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.some(e => e.key === 'TypeScript Config')).toBe(true);
  });

  test('should search context by time', () => {
    // Store some context
    db.storeContext({
      type: 'note',
      key: 'Recent Note',
      value: 'This was just added',
    });

    // Search for recent updates
    const results = db.searchContext({
      since: '-1 minute'
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].key).toBe('Recent Note');
  });

  test('should track update history', () => {
    const project = db.upsertProject({ name: 'test-project' });
    
    // Get recent updates
    const updates = db.getRecentUpdates('-1 minute', 10);
    expect(updates.length).toBeGreaterThan(0);
    expect(updates[0].entity_type).toBe('project');
    expect(updates[0].action).toBe('upsert');
  });
});

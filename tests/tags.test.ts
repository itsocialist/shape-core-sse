import { describe, test, expect } from '@jest/globals';
import { DatabaseManager } from '../src/db/database.js';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

describe('Tag Search Functionality', () => {
  let db: DatabaseManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'mcp-test-'));
    const dbPath = join(tempDir, 'test.db');
    db = await DatabaseManager.create(dbPath);
  });

  afterEach(() => {
    db.close();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('should search by single tag', () => {
    const project = db.upsertProject({
      name: 'tag-test',
      description: 'Test project for tags'
    });

    // Create entries with different tags
    db.storeContext({
      project_id: project.id,
      type: 'note',
      key: 'entry1',
      value: 'Entry with security tag',
      tags: ['security', 'important']
    });

    db.storeContext({
      project_id: project.id,
      type: 'note',
      key: 'entry2',
      value: 'Entry with test tag',
      tags: ['test', 'development']
    });

    db.storeContext({
      project_id: project.id,
      type: 'note',
      key: 'entry3',
      value: 'Entry with both tags',
      tags: ['security', 'test', 'critical']
    });

    // Search by single tag
    const results = db.searchContext({ tags: ['security'] });
    expect(results).toHaveLength(2);
    expect(results.map(r => r.key).sort()).toEqual(['entry1', 'entry3']);
  });

  test('should search by multiple tags (OR operation)', () => {
    const project = db.upsertProject({
      name: 'tag-test-2',
      description: 'Test OR operation'
    });

    db.storeContext({
      project_id: project.id,
      type: 'note',
      key: 'has-alpha',
      value: 'Has alpha tag',
      tags: ['alpha']
    });

    db.storeContext({
      project_id: project.id,
      type: 'note',
      key: 'has-beta',
      value: 'Has beta tag',
      tags: ['beta']
    });

    db.storeContext({
      project_id: project.id,
      type: 'note',
      key: 'has-both',
      value: 'Has both tags',
      tags: ['alpha', 'beta']
    });

    db.storeContext({
      project_id: project.id,
      type: 'note',
      key: 'has-neither',
      value: 'Has neither tag',
      tags: ['gamma']
    });

    // Search for alpha OR beta
    const results = db.searchContext({ tags: ['alpha', 'beta'] });
    expect(results).toHaveLength(3);
    expect(results.map(r => r.key).sort()).toEqual(['has-alpha', 'has-beta', 'has-both']);
  });

  test('should handle empty tags array in search', () => {
    const project = db.upsertProject({
      name: 'tag-test-3',
      description: 'Test empty tags'
    });

    db.storeContext({
      project_id: project.id,
      type: 'note',
      key: 'no-tags',
      value: 'Entry without tags',
      tags: []
    });

    // Search with empty tags should not filter by tags
    const results = db.searchContext({ 
      project_name: 'tag-test-3',
      tags: [] 
    });
    expect(results).toHaveLength(1);
  });

  test('should combine tag search with other filters', () => {
    const project = db.upsertProject({
      name: 'tag-test-4',
      description: 'Test combined filters'
    });

    db.storeContext({
      project_id: project.id,
      type: 'decision',
      key: 'decision1',
      value: 'Important decision',
      tags: ['architecture', 'security']
    });

    db.storeContext({
      project_id: project.id,
      type: 'note',
      key: 'note1',
      value: 'Security note',
      tags: ['security', 'documentation']
    });

    db.storeContext({
      project_id: project.id,
      type: 'decision',
      key: 'decision2',
      value: 'Another decision',
      tags: ['performance']
    });

    // Search for decisions with security tag
    const results = db.searchContext({
      type: 'decision',
      tags: ['security']
    });
    
    expect(results).toHaveLength(1);
    expect(results[0].key).toBe('decision1');
  });
});

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { DatabaseManager } from '../src/db/database.js';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

describe('Search Functionality', () => {
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

  test('should handle hyphenated search terms correctly', () => {
    // Create a project
    const project = db.upsertProject({
      name: 'search-test',
      description: 'Test project for search'
    });

    // Store context with hyphenated content
    const context = db.storeContext({
      project_id: project.id,
      type: 'note',
      key: 'test-hyphen',
      value: 'This contains ALPHA-BRAVO-CHARLIE-42 as a test code'
    });

    // Search for hyphenated term - should not throw error
    const results = db.searchContext({
      query: 'ALPHA-BRAVO-CHARLIE'
    });

    expect(results).toHaveLength(1);
    expect(results[0].value).toContain('ALPHA-BRAVO-CHARLIE-42');
  });

  test('should handle special characters in search', () => {
    const project = db.upsertProject({
      name: 'search-test-2',
      description: 'Test project for special chars'
    });

    // Test various special characters
    const testCases = [
      { content: 'test+plus', query: 'test+plus' },
      { content: 'test*asterisk', query: 'test*asterisk' },
      { content: 'test:colon', query: 'test:colon' },
      { content: 'test"quote"test', query: 'test"quote"test' },
      { content: 'test(parenthesis)', query: 'test(parenthesis)' }
    ];

    testCases.forEach((testCase, index) => {
      db.storeContext({
        project_id: project.id,
        type: 'note',
        key: `test-special-${index}`,
        value: `Content with ${testCase.content} inside`
      });
    });

    // Each search should work without SQL errors
    testCases.forEach((testCase) => {
      expect(() => {
        const results = db.searchContext({ query: testCase.query });
        expect(results.length).toBeGreaterThanOrEqual(0);
      }).not.toThrow();
    });
  });

  test('should handle phrase search with quotes', () => {
    const project = db.upsertProject({
      name: 'phrase-test',
      description: 'Test phrase search'
    });

    db.storeContext({
      project_id: project.id,
      type: 'note',
      key: 'phrase-1',
      value: 'The quick brown fox jumps over the lazy dog'
    });

    db.storeContext({
      project_id: project.id,
      type: 'note',  
      key: 'phrase-2',
      value: 'The quick red fox runs through the forest'
    });

    // Search for exact phrase
    const results = db.searchContext({
      query: 'quick brown fox'
    });

    expect(results).toHaveLength(1);
    expect(results[0].key).toBe('phrase-1');
  });
});

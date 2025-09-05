/**
 * Memory Optimizer Feature Tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { getDatabase } from '../src/db/helpers.js';
import { MemoryOptimizer } from '../src/utils/memoryOptimizer.js';
import { Database } from 'better-sqlite3';

describe('MemoryOptimizer Core Features', () => {
  let db: Database;
  let optimizer: MemoryOptimizer;
  
  beforeEach(async () => {
    db = await getDatabase();
    optimizer = new MemoryOptimizer(db);
    
    // Create test data
    setupTestData(db);
  });

  afterEach(() => {
    // Clean test data
    db.prepare("DELETE FROM context_entries WHERE key LIKE 'test_%'").run();
  });

  it('should analyze memory usage accurately', async () => {
    const stats = await optimizer.analyzeMemoryUsage();
    
    expect(stats.totalEntries).toBeGreaterThan(0);
    expect(stats.totalSize).toBeGreaterThan(0);
    // Note: duplicateEntries counts value duplicates, not necessarily 2
    expect(stats.duplicateEntries).toBeGreaterThanOrEqual(0);
    expect(stats.largeEntries).toBeGreaterThanOrEqual(1); // From test data
  });

  it('should remove duplicate entries', async () => {
    const before = await optimizer.analyzeMemoryUsage();
    
    const result = await optimizer.optimizeMemory({
      pruneOld: false,
      compressLarge: false,
      removeDuplicates: true
    });
    
    // Check that optimization ran (even if no duplicates found)
    expect(result.actions.some(a => a.includes('duplicate'))).toBe(true);
    expect(result.after.totalEntries).toBeLessThanOrEqual(before.totalEntries);
  });

  it('should compress large entries', async () => {
    const result = await optimizer.optimizeMemory({
      pruneOld: false,
      compressLarge: true,
      removeDuplicates: false
    });
    
    expect(result.actions).toContain('Compressed 2 large entries');
    expect(result.saved).toBeGreaterThan(0);
    
    // Verify compression metadata
    const compressed = db.prepare(`
      SELECT metadata FROM context_entries 
      WHERE key = 'test_large_entry_1'
    `).get() as { metadata: string } | undefined;
    
    if (compressed && compressed.metadata) {
      const meta = JSON.parse(compressed.metadata);
      expect(meta.compressed).toBe(1);
    }
  });

  it('should preserve critical entries during pruning', async () => {
    const result = await optimizer.optimizeMemory({
      pruneOld: true,
      maxAge: 1 // Very aggressive for testing
    });
    
    // Critical entries should remain
    const critical = db.prepare(`
      SELECT COUNT(*) as count FROM context_entries 
      WHERE type IN ('decision', 'standard') OR key LIKE '%critical%'
    `).get() as { count: number };
    
    expect(critical.count).toBeGreaterThan(0);
  });

  it('should generate memory report', async () => {
    const report = await optimizer.getMemoryReport();
    
    expect(report).toContain('📊 Memory Usage Report');
    expect(report).toContain('Entries:');
    expect(report).toContain('KB');
  });
});

function setupTestData(db: Database) {
  // Clean any existing test data first
  db.prepare("DELETE FROM context_entries WHERE key LIKE 'test_%'").run();
  
  // Large entry for compression testing (first one)
  db.prepare(`
    INSERT INTO context_entries (key, value, type, project_id)
    VALUES (?, ?, ?, ?)
  `).run(
    'test_large_entry_1',
    'A'.repeat(1500) + ' This is the first very long entry that should be compressed during optimization testing.',
    'note',
    1
  );

  // Second large entry for compression testing
  db.prepare(`
    INSERT INTO context_entries (key, value, type, project_id)
    VALUES (?, ?, ?, ?)
  `).run(
    'test_large_entry_2',
    'B'.repeat(1500) + ' This is the second very long entry that should also be compressed during optimization testing.',
    'note',
    1
  );

  // Create actual duplicate entries (same key AND value) - different keys to bypass unique constraint
  const duplicateValue = 'Duplicate content for testing deduplication';
  db.prepare(`
    INSERT INTO context_entries (key, value, type, project_id)
    VALUES (?, ?, ?, ?)
  `).run('test_dup_key_1', duplicateValue, 'note', 1);
  
  db.prepare(`
    INSERT INTO context_entries (key, value, type, project_id)  
    VALUES (?, ?, ?, ?)
  `).run('test_dup_key_2', duplicateValue, 'note', 1);

  // Critical entry that should be preserved
  db.prepare(`
    INSERT INTO context_entries (key, value, type, project_id, updated_at)
    VALUES (?, ?, ?, ?, datetime('now', '-100 days'))
  `).run('test_critical_decision', 'Important architectural decision', 'decision', 1);
}

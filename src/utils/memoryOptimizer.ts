/**
 * Memory optimization service for context compression and pruning
 */

import { Database } from 'better-sqlite3';
import { getDatabase } from '../db/helpers.js';

interface MemoryStats {
  totalEntries: number;
  totalSize: number; // in characters
  oldEntries: number; // older than 30 days
  duplicateEntries: number;
  largeEntries: number; // over 1000 chars
}

interface OptimizationResult {
  before: MemoryStats;
  after: MemoryStats;
  saved: number; // characters saved
  actions: string[];
}

export class MemoryOptimizer {
  private db: Database;
  
  constructor(database?: Database) {
    if (database) {
      this.db = database;
    } else {
      // For now, require database to be passed in to avoid async issues
      throw new Error('Database must be provided to MemoryOptimizer constructor');
    }
  }

  async analyzeMemoryUsage(projectId?: number): Promise<MemoryStats> {
    const projectFilter = projectId ? 'WHERE project_id = ?' : '';
    const projectParams = projectId ? [projectId] : [];
    
    const totalQuery = this.db.prepare(`
      SELECT 
        COUNT(*) as count,
        SUM(LENGTH(key) + LENGTH(value)) as size
      FROM context_entries
      ${projectFilter}
    `).get(...projectParams) as { count: number; size: number };

    const oldQuery = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM context_entries 
      WHERE updated_at < datetime('now', '-30 days')
    `).get() as { count: number };

    const duplicateQuery = this.db.prepare(`
      SELECT COUNT(*) as duplicates FROM (
        SELECT key, value, COUNT(*) as cnt
        FROM context_entries
        GROUP BY key, value
        HAVING cnt > 1
      )
    `).get() as { duplicates: number };

    const largeQuery = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM context_entries
      WHERE LENGTH(value) > 1000
    `).get() as { count: number };

    return {
      totalEntries: totalQuery.count,
      totalSize: totalQuery.size || 0,
      oldEntries: oldQuery.count,
      duplicateEntries: duplicateQuery.duplicates || 0,
      largeEntries: largeQuery.count
    };
  }

  async optimizeMemory(options: {
    pruneOld?: boolean;
    compressLarge?: boolean;
    removeDuplicates?: boolean;
    maxAge?: number; // days
  } = {}): Promise<OptimizationResult> {
    const {
      pruneOld = true,
      compressLarge = true,
      removeDuplicates = true,
      maxAge = 90
    } = options;

    const before = await this.analyzeMemoryUsage();
    const actions: string[] = [];

    const transaction = this.db.transaction(() => {
      if (removeDuplicates) {
        const removed = this.removeDuplicateEntries();
        actions.push(`Removed ${removed} duplicate entries`);
      }

      if (pruneOld) {
        const pruned = this.pruneOldEntries(maxAge);
        if (pruned > 0) {
          actions.push(`Pruned ${pruned} entries older than ${maxAge} days`);
        }
      }

      if (compressLarge) {
        const compressed = this.compressLargeEntries();
        if (compressed > 0) {
          actions.push(`Compressed ${compressed} large entries`);
        }
      }

      // Update FTS index
      this.db.exec('DELETE FROM context_search');
      this.rebuildSearchIndex();
      actions.push('Rebuilt search index');
    });

    transaction();

    const after = await this.analyzeMemoryUsage();
    const saved = before.totalSize - after.totalSize;

    return {
      before,
      after,
      saved,
      actions
    };
  }

  private removeDuplicateEntries(): number {
    const result = this.db.prepare(`
      DELETE FROM context_entries 
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM context_entries
        GROUP BY project_id, type, key, value
      )
    `).run();
    
    return result.changes;
  }

  private pruneOldEntries(maxAge: number): number {
    // Only prune non-decision entries older than maxAge
    const result = this.db.prepare(`
      DELETE FROM context_entries 
      WHERE updated_at < datetime('now', '-${maxAge} days')
        AND type NOT IN ('decision', 'standard')
        AND key NOT LIKE '%critical%'
        AND key NOT LIKE '%important%'
    `).run();
    
    return result.changes;
  }

  private compressLargeEntries(): number {
    const largeEntries = this.db.prepare(`
      SELECT id, value FROM context_entries 
      WHERE LENGTH(value) > 1000
    `).all() as { id: number; value: string }[];

    let compressed = 0;
    const updateStmt = this.db.prepare(`
      UPDATE context_entries 
      SET value = ?, metadata = json_set(COALESCE(metadata, '{}'), '$.compressed', 1)
      WHERE id = ?
    `);

    for (const entry of largeEntries) {
      const compressedValue = this.compressText(entry.value);
      if (compressedValue.length < entry.value.length * 0.8) {
        updateStmt.run(compressedValue, entry.id);
        compressed++;
      }
    }

    return compressed;
  }

  private compressText(text: string): string {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove repeated phrases
      .replace(/(.{10,})\1+/g, '$1')
      // Truncate very long lines
      .split('\n')
      .map(line => line.length > 200 ? line.substring(0, 197) + '...' : line)
      .join('\n')
      .trim();
  }

  private rebuildSearchIndex(): void {
    this.db.prepare(`
      INSERT INTO context_search (entity_id, entity_type, content, tags)
      SELECT 
        id,
        'context_entry',
        key || ' ' || value,
        COALESCE(tags, '[]')
      FROM context_entries
    `).run();
  }

  async getMemoryReport(): Promise<string> {
    const stats = await this.analyzeMemoryUsage();
    const sizeKB = Math.round(stats.totalSize / 1024);
    
    return `📊 Memory Usage Report
• Entries: ${stats.totalEntries}
• Size: ${sizeKB} KB
• Old entries: ${stats.oldEntries}
• Large entries: ${stats.largeEntries}
• Duplicates: ${stats.duplicateEntries}`;
  }
}

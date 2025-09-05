#!/usr/bin/env node

/**
 * Command-line script to run memory optimization on Shape Core database
 */

import Database from 'better-sqlite3';
import { MemoryOptimizer } from '../src/utils/memoryOptimizer.js';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, writeFileSync } from 'fs';

async function exportContextData(db: Database.Database, exportPath: string): Promise<number> {
  console.log('\n📤 Exporting context data...');
  
  // Create export directory if needed
  const exportDir = dirname(exportPath);
  if (!existsSync(exportDir)) {
    mkdirSync(exportDir, { recursive: true });
  }
  
  // Query all context entries with project names
  const entries = db.prepare(`
    SELECT 
      ce.*,
      p.name as project_name,
      s.hostname as system_name
    FROM context_entries ce
    LEFT JOIN projects p ON ce.project_id = p.id
    LEFT JOIN systems s ON ce.system_id = s.id
    ORDER BY ce.project_id, ce.type, ce.key
  `).all();
  
  // Export as JSON with metadata
  const exportData = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    totalEntries: entries.length,
    entries: entries
  };
  
  writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
  console.log(`✅ Exported ${entries.length} entries to: ${exportPath}`);
  
  return entries.length;
}

async function main() {
  console.log('🧹 Shape Core Memory Optimizer\n');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const verbose = args.includes('--verbose') || args.includes('-v');
  const help = args.includes('--help') || args.includes('-h');
  const skipExport = args.includes('--skip-export');
  const projectIndex = args.findIndex(arg => arg === '--project' || arg === '-p');
  const projectName = projectIndex >= 0 ? args[projectIndex + 1] : null;
  
  if (help) {
    console.log('Usage: npm run optimize-memory [options]');
    console.log('\nOptions:');
    console.log('  -d, --dry-run     Analyze memory usage without making changes');
    console.log('  -v, --verbose     Show detailed optimization information');
    console.log('  -p, --project     Optimize only a specific project');
    console.log('  --skip-export     Skip automatic backup export before optimization');
    console.log('  -h, --help        Show this help message');
    console.log('\nExamples:');
    console.log('  npm run optimize-memory --dry-run');
    console.log('  npm run optimize-memory --project mpcm-pro');
    console.log('  npm run optimize-memory --verbose');
    console.log('  npm run optimize-memory --skip-export');
    process.exit(0);
  }
  
  try {
    // Initialize database path
    const dbPath = process.env.SHAPE_PRO_DB_PATH || join(homedir(), '.shape-core', 'shape-core.db');
    console.log(`📁 Database: ${dbPath}`);
    
    // Check if database exists
    if (!existsSync(dbPath)) {
      console.error(`❌ Database not found at ${dbPath}`);
      console.error('💡 Make sure Ship APE has been initialized first');
      process.exit(1);
    }
    
    // Open database directly with better-sqlite3
    const db = new Database(dbPath, { 
      readonly: dryRun,
      fileMustExist: true 
    });
    
    // Enable WAL mode for better performance
    if (!dryRun) {
      db.pragma('journal_mode = WAL');
    }
    
    // Get project ID if specified
    let projectId: number | undefined;
    if (projectName) {
      const project = db.prepare('SELECT id FROM projects WHERE name = ?').get(projectName) as { id: number } | undefined;
      if (!project) {
        console.error(`❌ Project '${projectName}' not found`);
        console.log('\n💡 Available projects:');
        const projects = db.prepare('SELECT name FROM projects ORDER BY name').all() as { name: string }[];
        projects.forEach(p => console.log(`   - ${p.name}`));
        process.exit(1);
      }
      projectId = project.id;
      console.log(`\n🎯 Optimizing project: ${projectName}`);
    }
    
    // Export data before optimization (unless dry-run or skip-export)
    if (!dryRun && !skipExport) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const prefix = projectName ? `${projectName}-` : '';
      const exportPath = join(dirname(dbPath), `${prefix}context-export-${timestamp}.json`);
      await exportContextData(db, exportPath);
    }
    
    // Create optimizer
    const optimizer = new MemoryOptimizer(db);
    
    // Analyze current memory usage
    console.log('\n📊 Analyzing memory usage...');
    const stats = await optimizer.analyzeMemoryUsage();
    
    console.log('\n📈 Current Status:');
    console.log(`  Total entries: ${stats.totalEntries.toLocaleString()}`);
    console.log(`  Total size: ${(stats.totalSize / 1024).toFixed(2)} KB`);
    console.log(`  Old entries (>30 days): ${stats.oldEntries.toLocaleString()}`);
    console.log(`  Duplicate entries: ${stats.duplicateEntries.toLocaleString()}`);
    console.log(`  Large entries (>1KB): ${stats.largeEntries.toLocaleString()}`);
    
    if (dryRun) {
      console.log('\n⚠️  Dry run mode - no changes will be made');
      
      // Calculate potential savings
      const potentialSavings = stats.oldEntries + stats.duplicateEntries;
      const estimatedSizeReduction = Math.floor(stats.totalSize * 0.2); // Rough estimate
      
      console.log('\n💡 Potential optimization:');
      console.log(`  Entries to remove: ${potentialSavings.toLocaleString()}`);
      console.log(`  Estimated size reduction: ~${(estimatedSizeReduction / 1024).toFixed(2)} KB`);
      
      // Suggest export
      if (stats.totalEntries > 0) {
        console.log('\n💾 To export data before optimization:');
        console.log('  npm run optimize-memory:export');
      }
    } else {
      // Perform optimization
      console.log('\n🔧 Optimizing memory...');
      const result = await optimizer.optimizeMemory();
      
      console.log('\n✅ Optimization Complete!');
      console.log('\n📊 Results:');
      console.log(`  Entries before: ${result.before.totalEntries.toLocaleString()}`);
      console.log(`  Entries after: ${result.after.totalEntries.toLocaleString()}`);
      console.log(`  Space saved: ${(result.saved / 1024).toFixed(2)} KB`);
      
      if (verbose && result.actions.length > 0) {
        console.log('\n📝 Actions taken:');
        result.actions.forEach(action => console.log(`  - ${action}`));
      }
      
      // Show percentage reduction
      const percentReduction = ((result.saved / result.before.totalSize) * 100).toFixed(1);
      console.log(`\n🎯 Reduced database size by ${percentReduction}%`);
    }
    
    // Close database
    db.close();
    
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);

#!/usr/bin/env node

/**
 * Export context data from Shape Core database
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, writeFileSync, statSync } from 'fs';

async function main() {
  console.log('📤 Shape Core Context Exporter\n');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const help = args.includes('--help') || args.includes('-h');
  const format = args.includes('--csv') ? 'csv' : 'json';
  const outputIndex = args.findIndex(arg => arg === '--output' || arg === '-o');
  const customOutput = outputIndex >= 0 ? args[outputIndex + 1] : null;
  
  if (help) {
    console.log('Usage: npm run optimize-memory:export [options]');
    console.log('\nOptions:');
    console.log('  --csv             Export as CSV instead of JSON');
    console.log('  -o, --output      Custom output file path');
    console.log('  -h, --help        Show this help message');
    console.log('\nExamples:');
    console.log('  npm run optimize-memory:export');
    console.log('  npm run optimize-memory:export --csv');
    console.log('  npm run optimize-memory:export --output ~/Desktop/backup.json');
    process.exit(0);
  }
  
  try {
    // Initialize database path
    const dbPath = process.env.SHAPE_PRO_DB_PATH || join(homedir(), '.shape-core', 'shape-core.db');
    console.log(`📁 Database: ${dbPath}`);
    
    // Check if database exists
    if (!existsSync(dbPath)) {
      console.error(`❌ Database not found at ${dbPath}`);
      process.exit(1);
    }
    
    // Open database
    const db = new Database(dbPath, { 
      readonly: true,
      fileMustExist: true 
    });
    
    // Query all data
    console.log('📊 Gathering context data...');
    
    const entries = db.prepare(`
      SELECT 
        ce.id,
        ce.type,
        ce.key,
        ce.value,
        ce.is_system_specific,
        ce.tags,
        ce.metadata,
        ce.created_at,
        ce.updated_at,
        ce.role_id,
        p.name as project_name,
        s.hostname as system_name
      FROM context_entries ce
      LEFT JOIN projects p ON ce.project_id = p.id
      LEFT JOIN systems s ON ce.system_id = s.id
      ORDER BY ce.project_id, ce.type, ce.key
    `).all();
    
    const projects = db.prepare(`
      SELECT * FROM projects ORDER BY name
    `).all();
    
    console.log(`  Found ${entries.length} context entries`);
    console.log(`  Found ${projects.length} projects`);
    
    // Determine output path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const defaultName = format === 'csv' ? `context-export-${timestamp}.csv` : `context-export-${timestamp}.json`;
    const outputPath = customOutput || join(dirname(dbPath), defaultName);
    
    // Create directory if needed
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    
    // Export based on format
    if (format === 'csv') {
      // CSV export
      const headers = [
        'ID', 'Project', 'Type', 'Key', 'Value', 'System', 'Role',
        'Tags', 'Created', 'Updated', 'System Specific'
      ];
      
      const csvContent = [
        headers.join(','),
        ...entries.map(e => [
          e.id,
          `"${(e.project_name || 'shared').replace(/"/g, '""')}"`,
          e.type,
          `"${e.key.replace(/"/g, '""')}"`,
          `"${e.value.replace(/"/g, '""').replace(/\n/g, '\\n')}"`,
          e.system_name || '',
          e.role_id || '',
          `"${(e.tags || '').replace(/"/g, '""')}"`,
          e.created_at,
          e.updated_at,
          e.is_system_specific ? 'Yes' : 'No'
        ].join(','))
      ].join('\n');
      
      writeFileSync(outputPath, csvContent);
      console.log(`\n✅ Exported to CSV: ${outputPath}`);
    } else {
      // JSON export with full data
      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        database: dbPath,
        summary: {
          totalEntries: entries.length,
          totalProjects: projects.length,
          types: [...new Set(entries.map(e => e.type))],
          roles: [...new Set(entries.map(e => e.role_id).filter(Boolean))]
        },
        projects: projects,
        entries: entries
      };
      
      writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
      console.log(`\n✅ Exported to JSON: ${outputPath}`);
    }
    
    // Show file size
    const stats = statSync(outputPath);
    console.log(`📄 File size: ${(stats.size / 1024).toFixed(2)} KB`);
    
    // Close database
    db.close();
    
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);

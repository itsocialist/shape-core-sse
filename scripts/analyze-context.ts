#!/usr/bin/env node

/**
 * Analytics tool for Shape Core context memory database
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

interface ProjectStats {
  id: number;
  name: string;
  entryCount: number;
  roleCount: number;
  typeBreakdown: Record<string, number>;
  oldestEntry: string;
  newestEntry: string;
  totalSize: number;
}

interface RoleStats {
  id: string;
  name: string;
  isCustom: boolean;
  projectCount: number;
  entryCount: number;
  lastUsed: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

async function analyzeDatabase(db: Database.Database) {
  console.log('📊 Shape Core Database Analytics\n');
  
  // Basic counts
  const projectCount = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
  const entryCount = db.prepare('SELECT COUNT(*) as count FROM context_entries').get() as { count: number };
  const roleCount = db.prepare('SELECT COUNT(*) as count FROM roles').get() as { count: number };
  const customRoleCount = db.prepare('SELECT COUNT(*) as count FROM roles WHERE is_custom = 1').get() as { count: number };
  const sharedEntryCount = db.prepare('SELECT COUNT(*) as count FROM context_entries WHERE project_id IS NULL').get() as { count: number };
  
  console.log('📈 Overview:');
  console.log(`  Total Projects: ${projectCount.count}`);
  console.log(`  Total Context Entries: ${entryCount.count}`);
  console.log(`  Total Roles: ${roleCount.count} (${roleCount.count - customRoleCount.count} default, ${customRoleCount.count} custom)`);
  console.log(`  Shared Context Entries: ${sharedEntryCount.count}`);
  
  // Database size
  const dbSize = db.prepare(`
    SELECT 
      SUM(LENGTH(key) + LENGTH(value) + COALESCE(LENGTH(tags), 0) + COALESCE(LENGTH(metadata), 0)) as total_size
    FROM context_entries
  `).get() as { total_size: number };
  
  console.log(`  Total Data Size: ${formatBytes(dbSize.total_size || 0)}`);
  
  // Entry types breakdown
  console.log('\n📋 Entry Types:');
  const types = db.prepare(`
    SELECT type, COUNT(*) as count 
    FROM context_entries 
    GROUP BY type 
    ORDER BY count DESC
  `).all() as { type: string; count: number }[];
  
  types.forEach(t => {
    const percentage = ((t.count / entryCount.count) * 100).toFixed(1);
    console.log(`  ${t.type}: ${t.count} (${percentage}%)`);
  });
  
  // Project statistics
  console.log('\n📁 Projects (Top 10 by entries):');
  const projects = db.prepare(`
    SELECT 
      p.id,
      p.name,
      p.status,
      COUNT(ce.id) as entry_count,
      COUNT(DISTINCT ce.role_id) as role_count,
      MIN(ce.created_at) as oldest_entry,
      MAX(ce.updated_at) as newest_entry,
      SUM(LENGTH(ce.key) + LENGTH(ce.value)) as total_size
    FROM projects p
    LEFT JOIN context_entries ce ON p.id = ce.project_id
    GROUP BY p.id
    ORDER BY entry_count DESC
    LIMIT 10
  `).all() as ProjectStats[];
  
  projects.forEach(p => {
    console.log(`\n  ${p.name} (${p.status || 'active'}):`);
    console.log(`    Entries: ${p.entry_count}`);
    console.log(`    Roles Used: ${p.role_count}`);
    console.log(`    Size: ${formatBytes(p.total_size || 0)}`);
    if (p.oldest_entry) {
      console.log(`    First Entry: ${formatDate(p.oldest_entry)}`);
      console.log(`    Last Update: ${formatDate(p.newest_entry)}`);
    }
  });
  
  // Role usage
  console.log('\n👥 Role Usage:');
  const roles = db.prepare(`
    SELECT 
      r.id,
      r.name,
      r.is_custom,
      COUNT(DISTINCT ce.project_id) as project_count,
      COUNT(ce.id) as entry_count,
      MAX(ce.updated_at) as last_used
    FROM roles r
    LEFT JOIN context_entries ce ON r.id = ce.role_id
    GROUP BY r.id
    ORDER BY entry_count DESC
  `).all() as RoleStats[];
  
  roles.forEach(r => {
    const roleType = r.isCustom ? '(custom)' : '(default)';
    console.log(`  ${r.name} ${roleType}:`);
    console.log(`    Used in ${r.projectCount} projects`);
    console.log(`    ${r.entryCount} entries`);
    if (r.lastUsed) {
      console.log(`    Last used: ${formatDate(r.lastUsed)}`);
    }
  });
  
  // Activity timeline
  console.log('\n📅 Recent Activity (Last 7 days):');
  const recentActivity = db.prepare(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as new_entries,
      COUNT(DISTINCT project_id) as active_projects
    FROM context_entries
    WHERE created_at > datetime('now', '-7 days')
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `).all() as { date: string; new_entries: number; active_projects: number }[];
  
  recentActivity.forEach(a => {
    console.log(`  ${a.date}: ${a.new_entries} new entries across ${a.active_projects} projects`);
  });
  
  // Large entries
  const largeEntries = db.prepare(`
    SELECT COUNT(*) as count 
    FROM context_entries 
    WHERE LENGTH(value) > 1000
  `).get() as { count: number };
  
  console.log(`\n💾 Storage Optimization:`);
  console.log(`  Large entries (>1KB): ${largeEntries.count}`);
  
  // Old entries
  const oldEntries = db.prepare(`
    SELECT COUNT(*) as count 
    FROM context_entries 
    WHERE updated_at < datetime('now', '-30 days')
  `).get() as { count: number };
  
  console.log(`  Old entries (>30 days): ${oldEntries.count}`);
}

async function main() {
  try {
    // Initialize database path
    const dbPath = process.env.SHAPE_PRO_DB_PATH || join(homedir(), '.shape-core', 'shape-core.db');
    
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
    
    await analyzeDatabase(db);
    
    // Close database
    db.close();
    
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);

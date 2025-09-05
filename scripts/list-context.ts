#!/usr/bin/env node

/**
 * List all projects and roles in Shape Core database
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

interface Project {
  id: number;
  name: string;
  description: string;
  status: string;
  repository_url: string;
  local_directory: string;
  created_at: string;
  updated_at: string;
  last_accessed: string;
  tags: string;
  metadata: string;
  entry_count?: number;
  size_kb?: number;
}

interface Role {
  id: string;
  name: string;
  description: string;
  focus_areas: string;
  default_tags: string;
  preferred_context_types: string;
  is_custom: boolean;
  created_by_system: string;
  created_at: string;
  base_role_id: string;
  usage_count?: number;
  project_count?: number;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

async function listProjects(db: Database.Database, verbose: boolean = false) {
  console.log('\n📁 Projects\n');
  
  const projects = db.prepare(`
    SELECT 
      p.*,
      COUNT(ce.id) as entry_count,
      ROUND(SUM(LENGTH(ce.key) + LENGTH(ce.value)) / 1024.0, 2) as size_kb
    FROM projects p
    LEFT JOIN context_entries ce ON p.id = ce.project_id
    GROUP BY p.id
    ORDER BY p.last_accessed DESC, p.name
  `).all() as Project[];
  
  console.log(`Total: ${projects.length} projects\n`);
  
  projects.forEach((p, index) => {
    const status = p.status || 'active';
    const statusEmoji = status === 'active' ? '🟢' : 
                       status === 'paused' ? '⏸️' : 
                       status === 'completed' ? '✅' : '📦';
    
    console.log(`${index + 1}. ${statusEmoji} ${p.name}`);
    
    if (p.description) {
      console.log(`   📝 ${p.description.slice(0, 100)}${p.description.length > 100 ? '...' : ''}`);
    }
    
    console.log(`   📊 ${p.entry_count || 0} entries (${p.size_kb || 0} KB)`);
    console.log(`   🕒 Last accessed: ${formatDate(p.last_accessed)}`);
    
    if (verbose) {
      if (p.repository_url) {
        console.log(`   🔗 Repo: ${p.repository_url}`);
      }
      if (p.local_directory) {
        console.log(`   📂 Local: ${p.local_directory}`);
      }
      if (p.tags) {
        try {
          const tags = JSON.parse(p.tags);
          if (tags.length > 0) {
            console.log(`   🏷️  Tags: ${tags.join(', ')}`);
          }
        } catch {}
      }
    }
    
    console.log('');
  });
}

async function listRoles(db: Database.Database, verbose: boolean = false) {
  console.log('\n👥 Roles\n');
  
  const roles = db.prepare(`
    SELECT 
      r.*,
      COUNT(DISTINCT ce.project_id) as project_count,
      COUNT(ce.id) as usage_count
    FROM roles r
    LEFT JOIN context_entries ce ON r.id = ce.role_id
    GROUP BY r.id
    ORDER BY r.is_custom, usage_count DESC
  `).all() as Role[];
  
  const defaultRoles = roles.filter(r => !r.is_custom);
  const customRoles = roles.filter(r => r.is_custom);
  
  console.log(`Total: ${roles.length} roles (${defaultRoles.length} default, ${customRoles.length} custom)\n`);
  
  if (defaultRoles.length > 0) {
    console.log('Default Roles:');
    defaultRoles.forEach(r => {
      const emoji = r.id === 'developer' ? '💻' :
                   r.id === 'ui-designer' ? '🎨' :
                   r.id === 'devops' ? '⚙️' :
                   r.id === 'qa' ? '🧪' :
                   r.id === 'architect' ? '🏗️' :
                   r.id === 'product-manager' ? '📋' : '👤';
      
      console.log(`\n  ${emoji} ${r.name} (${r.id})`);
      console.log(`     ${r.description}`);
      console.log(`     Used in ${r.project_count || 0} projects, ${r.usage_count || 0} entries`);
      
      if (verbose) {
        if (r.focus_areas) {
          try {
            const areas = JSON.parse(r.focus_areas);
            console.log(`     Focus: ${areas.join(', ')}`);
          } catch {}
        }
      }
    });
  }
  
  if (customRoles.length > 0) {
    console.log('\n\nCustom Roles:');
    customRoles.forEach(r => {
      console.log(`\n  🎭 ${r.name} (${r.id})`);
      console.log(`     ${r.description}`);
      if (r.base_role_id) {
        console.log(`     Based on: ${r.base_role_id}`);
      }
      console.log(`     Created by: ${r.created_by_system || 'Unknown'}`);
      console.log(`     Used in ${r.project_count || 0} projects, ${r.usage_count || 0} entries`);
      
      if (verbose) {
        if (r.focus_areas) {
          try {
            const areas = JSON.parse(r.focus_areas);
            console.log(`     Focus: ${areas.join(', ')}`);
          } catch {}
        }
      }
    });
  }
}

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const projectsOnly = args.includes('--projects') || args.includes('-p');
  const rolesOnly = args.includes('--roles') || args.includes('-r');
  const help = args.includes('--help') || args.includes('-h');
  
  if (help) {
    console.log('📋 Shape Core List Tool\n');
    console.log('Usage: npm run list-context [options]\n');
    console.log('Options:');
    console.log('  -p, --projects    Show only projects');
    console.log('  -r, --roles       Show only roles');
    console.log('  -v, --verbose     Show detailed information');
    console.log('  -h, --help        Show this help message');
    process.exit(0);
  }
  
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
    
    console.log('📋 Shape Core Database Contents');
    console.log(`📁 Database: ${dbPath}`);
    
    if (!rolesOnly) {
      await listProjects(db, verbose);
    }
    
    if (!projectsOnly) {
      await listRoles(db, verbose);
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

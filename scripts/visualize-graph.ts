#!/usr/bin/env node

/**
 * Visualize project context as a node graph
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, writeFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface Node {
  id: string;
  label: string;
  type: 'project' | 'role' | 'context' | 'type';
  size?: number;
  color?: string;
}

interface Edge {
  source: string;
  target: string;
  label?: string;
  weight?: number;
}

function generateGraphviz(projectName: string, nodes: Node[], edges: Edge[]): string {
  const dot = [`digraph "${projectName}" {`];
  dot.push('  rankdir=LR;');
  dot.push('  node [shape=box, style=rounded];');
  dot.push('  graph [fontsize=10];');
  dot.push('');
  
  // Define node styles by type
  dot.push('  // Node definitions');
  nodes.forEach(node => {
    const color = node.type === 'project' ? '#4CAF50' :
                 node.type === 'role' ? '#2196F3' :
                 node.type === 'type' ? '#FF9800' :
                 '#9C27B0';
    
    const shape = node.type === 'project' ? 'box' :
                 node.type === 'role' ? 'ellipse' :
                 node.type === 'type' ? 'diamond' :
                 'box';
    
    const size = node.size ? `, width=${Math.max(1, Math.log(node.size))}` : '';
    
    dot.push(`  "${node.id}" [label="${node.label}", fillcolor="${color}", style=filled, shape=${shape}${size}];`);
  });
  
  dot.push('');
  dot.push('  // Edge definitions');
  edges.forEach(edge => {
    const label = edge.label ? `, label="${edge.label}"` : '';
    const weight = edge.weight ? `, penwidth=${Math.min(5, edge.weight)}` : '';
    dot.push(`  "${edge.source}" -> "${edge.target}" [${label}${weight}];`);
  });
  
  dot.push('}');
  return dot.join('\n');
}

async function visualizeProject(db: Database.Database, projectName: string, outputPath: string) {
  // Get project
  const project = db.prepare('SELECT * FROM projects WHERE name = ?').get(projectName);
  if (!project) {
    throw new Error(`Project '${projectName}' not found`);
  }
  
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  // Add project node
  nodes.push({
    id: `project_${project.id}`,
    label: project.name,
    type: 'project'
  });
  
  // Get all context entries for project
  const entries = db.prepare(`
    SELECT 
      ce.*,
      r.name as role_name
    FROM context_entries ce
    LEFT JOIN roles r ON ce.role_id = r.id
    WHERE ce.project_id = ?
  `).all(project.id);
  
  // Group by role
  const roleGroups: Record<string, any[]> = {};
  const typeGroups: Record<string, any[]> = {};
  
  entries.forEach(entry => {
    const role = entry.role_id || 'no-role';
    const type = entry.type;
    
    if (!roleGroups[role]) roleGroups[role] = [];
    if (!typeGroups[type]) typeGroups[type] = [];
    
    roleGroups[role].push(entry);
    typeGroups[type].push(entry);
  });
  
  // Add role nodes and edges
  Object.entries(roleGroups).forEach(([roleId, roleEntries]) => {
    if (roleId !== 'no-role') {
      const roleName = roleEntries[0].role_name || roleId;
      nodes.push({
        id: `role_${roleId}`,
        label: `${roleName}\\n(${roleEntries.length} entries)`,
        type: 'role',
        size: roleEntries.length
      });
      
      edges.push({
        source: `project_${project.id}`,
        target: `role_${roleId}`,
        weight: Math.log(roleEntries.length + 1)
      });
    }
  });
  
  // Add type nodes and edges
  Object.entries(typeGroups).forEach(([type, typeEntries]) => {
    nodes.push({
      id: `type_${type}`,
      label: `${type}\\n(${typeEntries.length})`,
      type: 'type',
      size: typeEntries.length
    });
    
    // Connect types to roles
    typeEntries.forEach(entry => {
      const roleId = entry.role_id || 'no-role';
      if (roleId !== 'no-role') {
        const edgeId = `role_${roleId}_type_${type}`;
        if (!edges.find(e => e.source === `role_${roleId}` && e.target === `type_${type}`)) {
          edges.push({
            source: `role_${roleId}`,
            target: `type_${type}`
          });
        }
      } else {
        edges.push({
          source: `project_${project.id}`,
          target: `type_${type}`
        });
      }
    });
  });
  
  // Add some key context nodes
  const keyEntries = db.prepare(`
    SELECT * FROM context_entries 
    WHERE project_id = ? AND type IN ('decision', 'standard')
    ORDER BY updated_at DESC
    LIMIT 10
  `).all(project.id);
  
  keyEntries.forEach((entry, index) => {
    const shortKey = entry.key.length > 30 ? entry.key.substring(0, 30) + '...' : entry.key;
    nodes.push({
      id: `context_${entry.id}`,
      label: `${shortKey}`,
      type: 'context'
    });
    
    edges.push({
      source: `type_${entry.type}`,
      target: `context_${entry.id}`
    });
  });
  
  // Generate graphviz
  const dot = generateGraphviz(projectName, nodes, edges);
  const dotPath = outputPath.replace(/\.[^.]+$/, '.dot');
  writeFileSync(dotPath, dot);
  
  console.log(`✅ Generated graph: ${dotPath}`);
  
  // Try to render with graphviz if available
  try {
    const format = outputPath.endsWith('.png') ? 'png' : 'svg';
    await execAsync(`dot -T${format} "${dotPath}" -o "${outputPath}"`);
    console.log(`✅ Rendered graph: ${outputPath}`);
  } catch (error) {
    console.log('💡 Install Graphviz to render the graph: brew install graphviz');
    console.log('   Then run: dot -Tpng graph.dot -o graph.png');
  }
}

async function main() {
  const args = process.argv.slice(2);
  const projectIndex = args.findIndex(arg => arg === '--project' || arg === '-p');
  const projectName = projectIndex >= 0 ? args[projectIndex + 1] : null;
  const outputIndex = args.findIndex(arg => arg === '--output' || arg === '-o');
  const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
  const help = args.includes('--help') || args.includes('-h');
  
  if (help || !projectName) {
    console.log('🔍 Shape Core Project Graph Visualizer\n');
    console.log('Usage: npm run visualize-graph -- --project <name> [options]\n');
    console.log('Options:');
    console.log('  -p, --project     Project name to visualize (required)');
    console.log('  -o, --output      Output file path (default: project-graph.png)');
    console.log('  -h, --help        Show this help message');
    console.log('\nExample:');
    console.log('  npm run visualize-graph -- --project mpcm-pro');
    console.log('  npm run visualize-graph -- --project mpcm-pro --output ~/Desktop/graph.svg');
    process.exit(0);
  }
  
  try {
    const dbPath = process.env.SHAPE_PRO_DB_PATH || join(homedir(), '.shape-core', 'shape-core.db');
    
    if (!existsSync(dbPath)) {
      console.error(`❌ Database not found at ${dbPath}`);
      process.exit(1);
    }
    
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    
    const defaultOutput = `${projectName.replace(/[^a-z0-9]/gi, '-')}-graph.png`;
    const output = outputPath || defaultOutput;
    
    console.log(`📊 Visualizing project: ${projectName}`);
    await visualizeProject(db, projectName, output);
    
    db.close();
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch(console.error);

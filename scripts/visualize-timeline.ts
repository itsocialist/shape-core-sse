#!/usr/bin/env node

/**
 * Generate timeline visualization for Shape Core projects
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync, writeFileSync } from 'fs';

interface TimelineEntry {
  date: string;
  time: string;
  type: string;
  key: string;
  value_preview: string;
  role: string;
  project: string;
}

function generateTimelineHTML(entries: TimelineEntry[], title: string): string {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 20px;
      background: #f5f5f5;
    }
    h1 {
      color: #333;
      border-bottom: 2px solid #4CAF50;
      padding-bottom: 10px;
    }
    .timeline {
      position: relative;
      padding: 20px 0;
    }
    .timeline-line {
      position: absolute;
      left: 50px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: #ddd;
    }
    .timeline-entry {
      position: relative;
      margin-bottom: 30px;
      padding-left: 80px;
    }
    .timeline-dot {
      position: absolute;
      left: 42px;
      top: 5px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 3px solid #fff;
      background: #4CAF50;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .timeline-dot.decision { background: #2196F3; }
    .timeline-dot.code { background: #FF9800; }
    .timeline-dot.standard { background: #9C27B0; }
    .timeline-dot.status { background: #4CAF50; }
    .timeline-dot.todo { background: #F44336; }
    .timeline-dot.note { background: #607D8B; }
    .timeline-dot.issue { background: #FF5722; }
    
    .timeline-date {
      position: absolute;
      left: -80px;
      top: 5px;
      width: 100px;
      text-align: right;
      color: #666;
      font-size: 12px;
      font-weight: bold;
    }
    .timeline-card {
      background: white;
      border-radius: 8px;
      padding: 15px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .timeline-type {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      color: white;
    }
    .timeline-type.decision { background: #2196F3; }
    .timeline-type.code { background: #FF9800; }
    .timeline-type.standard { background: #9C27B0; }
    .timeline-type.status { background: #4CAF50; }
    .timeline-type.todo { background: #F44336; }
    .timeline-type.note { background: #607D8B; }
    .timeline-type.issue { background: #FF5722; }
    
    .timeline-key {
      font-weight: bold;
      color: #333;
      margin-bottom: 5px;
    }
    .timeline-value {
      color: #666;
      font-size: 14px;
      line-height: 1.5;
    }
    .timeline-meta {
      margin-top: 10px;
      font-size: 12px;
      color: #999;
    }
    .filters {
      margin-bottom: 30px;
      padding: 15px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .filter-btn {
      padding: 5px 15px;
      margin-right: 10px;
      border: 1px solid #ddd;
      border-radius: 20px;
      background: white;
      cursor: pointer;
      font-size: 12px;
    }
    .filter-btn.active {
      background: #4CAF50;
      color: white;
      border-color: #4CAF50;
    }
  </style>
</head>
<body>
  <h1>${title}</h1>
  
  <div class="filters">
    <button class="filter-btn active" onclick="filterTimeline('all')">All</button>
    <button class="filter-btn" onclick="filterTimeline('decision')">Decisions</button>
    <button class="filter-btn" onclick="filterTimeline('code')">Code</button>
    <button class="filter-btn" onclick="filterTimeline('status')">Status</button>
    <button class="filter-btn" onclick="filterTimeline('issue')">Issues</button>
  </div>
  
  <div class="timeline">
    <div class="timeline-line"></div>
    ${entries.map(entry => `
      <div class="timeline-entry" data-type="${entry.type}">
        <div class="timeline-dot ${entry.type}"></div>
        <div class="timeline-date">${entry.date}<br>${entry.time}</div>
        <div class="timeline-card">
          <div class="timeline-header">
            <span class="timeline-type ${entry.type}">${entry.type}</span>
            ${entry.role ? `<span style="color: #999; font-size: 12px;">Role: ${entry.role}</span>` : ''}
          </div>
          <div class="timeline-key">${entry.key}</div>
          <div class="timeline-value">${entry.value_preview}</div>
          <div class="timeline-meta">
            ${entry.project}
          </div>
        </div>
      </div>
    `).join('')}
  </div>
  
  <script>
    function filterTimeline(type) {
      const buttons = document.querySelectorAll('.filter-btn');
      buttons.forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      
      const entries = document.querySelectorAll('.timeline-entry');
      entries.forEach(entry => {
        if (type === 'all' || entry.dataset.type === type) {
          entry.style.display = 'block';
        } else {
          entry.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>`;
  
  return html;
}

async function generateProjectTimeline(db: Database.Database, projectName: string, outputPath: string) {
  const project = db.prepare('SELECT * FROM projects WHERE name = ?').get(projectName);
  if (!project) {
    throw new Error(`Project '${projectName}' not found`);
  }
  
  const entries = db.prepare(`
    SELECT 
      datetime(ce.created_at) as created_at,
      ce.type,
      ce.key,
      SUBSTR(ce.value, 1, 200) as value_preview,
      r.name as role_name
    FROM context_entries ce
    LEFT JOIN roles r ON ce.role_id = r.id
    WHERE ce.project_id = ?
    ORDER BY ce.created_at DESC
    LIMIT 100
  `).all(project.id) as any[];
  
  const timelineEntries: TimelineEntry[] = entries.map(e => {
    const dt = new Date(e.created_at);
    return {
      date: dt.toLocaleDateString(),
      time: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: e.type,
      key: e.key,
      value_preview: e.value_preview + (e.value_preview.length >= 200 ? '...' : ''),
      role: e.role_name || 'No role',
      project: projectName
    };
  });
  
  const html = generateTimelineHTML(timelineEntries, `${projectName} Timeline`);
  writeFileSync(outputPath, html);
  console.log(`✅ Generated timeline: ${outputPath}`);
}

async function generateFullTimeline(db: Database.Database, outputPath: string) {
  const entries = db.prepare(`
    SELECT 
      datetime(ce.created_at) as created_at,
      ce.type,
      ce.key,
      SUBSTR(ce.value, 1, 200) as value_preview,
      r.name as role_name,
      p.name as project_name
    FROM context_entries ce
    LEFT JOIN roles r ON ce.role_id = r.id
    LEFT JOIN projects p ON ce.project_id = p.id
    ORDER BY ce.created_at DESC
    LIMIT 200
  `).all() as any[];
  
  const timelineEntries: TimelineEntry[] = entries.map(e => {
    const dt = new Date(e.created_at);
    return {
      date: dt.toLocaleDateString(),
      time: dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: e.type,
      key: e.key,
      value_preview: e.value_preview + (e.value_preview.length >= 200 ? '...' : ''),
      role: e.role_name || 'No role',
      project: e.project_name || 'Shared'
    };
  });
  
  const html = generateTimelineHTML(timelineEntries, 'Shape Core Full Timeline');
  writeFileSync(outputPath, html);
  console.log(`✅ Generated timeline: ${outputPath}`);
}

async function main() {
  const args = process.argv.slice(2);
  const projectIndex = args.findIndex(arg => arg === '--project' || arg === '-p');
  const projectName = projectIndex >= 0 ? args[projectIndex + 1] : null;
  const outputIndex = args.findIndex(arg => arg === '--output' || arg === '-o');
  const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
  const help = args.includes('--help') || args.includes('-h');
  
  if (help) {
    console.log('📅 Shape Core Timeline Generator\n');
    console.log('Usage: npm run visualize-timeline [options]\n');
    console.log('Options:');
    console.log('  -p, --project     Project name (omit for full timeline)');
    console.log('  -o, --output      Output HTML file (default: timeline.html)');
    console.log('  -h, --help        Show this help message');
    console.log('\nExamples:');
    console.log('  npm run visualize-timeline');
    console.log('  npm run visualize-timeline -- --project mpcm-pro');
    console.log('  npm run visualize-timeline -- --output ~/Desktop/timeline.html');
    process.exit(0);
  }
  
  try {
    const dbPath = process.env.SHAPE_PRO_DB_PATH || join(homedir(), '.shape-core', 'shape-core.db');
    
    if (!existsSync(dbPath)) {
      console.error(`❌ Database not found at ${dbPath}`);
      process.exit(1);
    }
    
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    
    const defaultOutput = projectName ? `${projectName}-timeline.html` : 'timeline.html';
    const output = outputPath || defaultOutput;
    
    if (projectName) {
      console.log(`📅 Generating timeline for project: ${projectName}`);
      await generateProjectTimeline(db, projectName, output);
    } else {
      console.log('📅 Generating full database timeline');
      await generateFullTimeline(db, output);
    }
    
    db.close();
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch(console.error);

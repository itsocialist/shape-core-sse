# Shape Core Context Management Tools

A comprehensive suite of tools for analyzing, managing, and visualizing the Shape Core context memory database.

## Available Commands

### 1. Memory Optimization

Optimize database by removing old entries, merging duplicates, and compressing large texts.

```bash
# Analyze without changes (recommended first)
npm run optimize-memory:dry-run

# Optimize entire database (auto-exports first)
npm run optimize-memory

# Optimize specific project
npm run optimize-memory -- --project mpcm-pro

# Skip automatic backup
npm run optimize-memory -- --skip-export

# Verbose output
npm run optimize-memory -- --verbose
```

### 2. Context Export

Export all context data for backup or analysis.

```bash
# Export to JSON
npm run optimize-memory:export

# Export to CSV
npm run optimize-memory:export -- --csv

# Export to custom location
npm run optimize-memory:export -- --output ~/Desktop/backup.json
```

### 3. Database Analytics

Get comprehensive statistics about your context memory.

```bash
# Show database analytics
npm run analyze-context
```

Output includes:
- Total projects, entries, and roles
- Entry type breakdown
- Top projects by entry count
- Role usage statistics
- Recent activity timeline
- Storage optimization opportunities

### 4. List Projects & Roles

View all projects and roles in the database.

```bash
# List all projects and roles
npm run list-context

# List only projects
npm run list-context -- --projects

# List only roles
npm run list-context -- --roles

# Show detailed information
npm run list-context -- --verbose
```

### 5. Project Graph Visualization

Generate a node graph showing project structure, roles, and context relationships.

```bash
# Visualize a specific project
npm run visualize-graph -- --project mpcm-pro

# Custom output path
npm run visualize-graph -- --project mpcm-pro --output ~/Desktop/graph.png

# Generate SVG instead of PNG
npm run visualize-graph -- --project mpcm-pro --output graph.svg
```

**Note**: Requires Graphviz installed (`brew install graphviz` on macOS)

The graph shows:
- Project as the root node
- Roles as primary branches
- Context types connected to roles
- Key decisions and standards as leaf nodes

### 6. Timeline Visualization

Generate interactive HTML timeline of context entries.

```bash
# Generate timeline for entire database
npm run visualize-timeline

# Generate timeline for specific project
npm run visualize-timeline -- --project mpcm-pro

# Custom output path
npm run visualize-timeline -- --output ~/Desktop/timeline.html
```

Features:
- Interactive filters by context type
- Color-coded entries
- Role attribution
- Expandable value previews

## Example Workflow

1. **Analyze your database**
   ```bash
   npm run analyze-context
   ```

2. **List projects to find what to optimize**
   ```bash
   npm run list-context
   ```

3. **Export data for safety**
   ```bash
   npm run optimize-memory:export
   ```

4. **Visualize a project before optimization**
   ```bash
   npm run visualize-graph -- --project mpcm-pro
   ```

5. **Optimize a specific project**
   ```bash
   npm run optimize-memory -- --project mpcm-pro --dry-run
   npm run optimize-memory -- --project mpcm-pro
   ```

6. **Generate timeline to see changes**
   ```bash
   npm run visualize-timeline -- --project mpcm-pro
   ```

## Database Location

All tools operate on the main Shape Core database:
- Default: `~/.shape-core/shape-core.db`
- Override with: `SHAPE_PRO_DB_PATH` environment variable

## Output Files

- **Exports**: Saved in `~/.shape-core/` with timestamps
- **Graphs**: Saved in current directory (or specified path)
- **Timelines**: Saved as HTML files, viewable in any browser

## Tips

1. Always run `--dry-run` before optimization
2. Use `analyze-context` to identify large projects
3. Export data before major operations
4. Graph visualization helps understand project structure
5. Timeline view is great for debugging role interactions

## Requirements

- Node.js 18+
- Shape Core installed and initialized
- Graphviz (optional, for graph rendering)

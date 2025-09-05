# Memory Optimization Script

A command-line utility to optimize the Shape Core database by removing old entries, merging duplicates, and compressing large text entries.

**Note**: This script operates on the main Shape Core database (`~/.shape-core/shape-core.db`), not the Ship APE database.

## Key Features

- **Automatic Backup**: Exports all context data before optimization (can be disabled with `--skip-export`)
- **Safe Dry-Run Mode**: Preview changes without modifying the database
- **Data Export**: Standalone export functionality in JSON or CSV format

## Usage

### Export Data (Recommended First)
```bash
# Export to JSON (default)
npm run optimize-memory:export

# Export to CSV
npm run optimize-memory:export -- --csv

# Export to custom location
npm run optimize-memory:export -- --output ~/Desktop/backup.json
```

### Dry Run (Analysis Only)
```bash
npm run optimize-memory:dry-run
```
This will analyze the database and show potential optimizations without making any changes.

### Run Optimization
```bash
npm run optimize-memory
```
This will:
1. **Automatically export** all data to a timestamped JSON file
2. Perform the optimization:
   - Remove entries older than 30 days
   - Merge duplicate entries (keeping the newest)
   - Compress large text entries (>1KB)

### Command Line Options
```bash
node scripts/optimize-memory.js [options]

Options:
  -d, --dry-run     Analyze memory usage without making changes
  -v, --verbose     Show detailed optimization information
  --skip-export     Skip automatic backup export before optimization
  -h, --help        Show help message
```

## What It Does

1. **Analyzes Current Usage**
   - Total number of context entries
   - Total database size
   - Number of old entries (>30 days)
   - Number of duplicate entries
   - Number of large entries (>1KB)

2. **Optimization Actions** (when not in dry-run mode)
   - **Remove Old Entries**: Deletes context entries that haven't been updated in 30 days
   - **Merge Duplicates**: Keeps only the newest version of duplicate entries (same project, type, and key)
   - **Compress Large Entries**: Applies text compression to entries larger than 1KB (removes excessive whitespace)

3. **Results Report**
   - Shows before/after statistics
   - Reports space saved
   - Lists actions taken (in verbose mode)

## Example Output

```
🧹 Shape Core Memory Optimizer

📁 Database: /Users/username/.shape-core/shape-core.db

📊 Analyzing memory usage...

📈 Current Status:
  Total entries: 1,234
  Total size: 456.78 KB
  Old entries (>30 days): 123
  Duplicate entries: 45
  Large entries (>1KB): 67

🔧 Optimizing memory...

✅ Optimization Complete!

📊 Results:
  Entries before: 1,234
  Entries after: 1,066
  Space saved: 89.12 KB

🎯 Reduced database size by 19.5%
```

## Safety Notes

- **Automatic Backup**: By default, the optimization script exports all data before making changes
- Use `--dry-run` first to preview what will be changed
- To skip automatic export (not recommended), use `--skip-export`
- The script operates directly on the database, so changes are permanent
- Export files are saved in the same directory as the database with timestamps

## When to Use

- When the Shape Core database feels slow
- After extensive project work (many context entries created)
- As part of regular maintenance (monthly)
- Before backing up or migrating the database

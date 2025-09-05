# v0.3.1 - Deletion Tools & Performance Fixes 🧹

**Release Date:** June 23, 2025

## Overview

This release introduces **deletion tools** to help manage your context memory effectively, along with critical performance optimizations and bug fixes.

## What's New

### 🎯 New Features

**Three New Deletion Tools:**

1. **`delete_project`** - Remove a project and all associated data
   - Requires confirmation for safety
   - Permanently deletes all contexts, role assignments, and handoffs
   - Example: `"Delete project 'old-prototype' with confirmation"`

2. **`delete_context`** - Remove specific context entries
   - Can be scoped to a specific project
   - Useful for cleaning up outdated information
   - Example: `"Delete context 'outdated-api-docs' from project 'my-app'"`

3. **`cleanup_old_data`** - Time-based data cleanup
   - Preview mode (dry run) by default for safety
   - Specify time periods like "30 days", "6 months", "1 year"
   - Shows what would be deleted before actually deleting
   - Example: `"Preview cleanup of data older than 30 days"`

### 🐛 Bug Fixes

- **Fixed FTS5 search functionality** - Virtual tables now properly handle search queries
- **Performance optimization** - Added result limits to prevent out-of-memory errors on large datasets
- **Improved error handling** - Better error messages for deletion operations

### 🚀 Performance Improvements

- Search results are now limited to prevent memory issues
- Database queries optimized for large context stores
- Better handling of concurrent operations

## Technical Details

### Implementation Notes

- Switched from soft delete to hard delete for simplicity and reliability
- Deletion operations now permanently remove data immediately
- All deletion tools require explicit confirmation
- Fixed MCP tool connection issues by using factory pattern
- Updated FTS5 queries to use correct column names (entity_id, not project_name)

### Breaking Changes

None. This release is fully backward compatible with v0.3.0.

## Installation

```bash
npm install mcp-context-memory@0.3.1
```

Or if using npx directly in Claude Desktop:
```json
{
  "mcpServers": {
    "context-memory": {
      "command": "npx",
      "args": ["mcp-context-memory@0.3.1"]
    }
  }
}
```

## Upgrade Notes

No special upgrade steps required. The new deletion tools are immediately available after updating.

## Contributors

- **Development Team**: Emergency 2-hour sprint implementation
- **QA Team**: 5 rounds of thorough testing to ensure reliability
- **DevOps**: Release coordination and documentation

## What's Next

v0.4.0 is planned to focus on stability and security improvements based on code review feedback, including:
- Path traversal security fixes
- Enhanced error handling
- Data validation improvements
- Migration system implementation

---

**Full Changelog**: https://github.com/itsocialist/mcp-context-memory/compare/v0.3.0...v0.3.1
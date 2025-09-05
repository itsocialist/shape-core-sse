# Release Notes - v0.2.1

## 🐛 Bug Fixes & Improvements

This patch release addresses critical issues discovered during v0.2.0 testing.

### 🔧 Fixed Issues

#### 1. Test Database Isolation
- **Problem**: Test databases were persisting between test runs, causing contamination
- **Solution**: Implemented `TestDatabaseManager` with proper isolation
  - Each test gets a unique temporary database
  - Automatic cleanup after tests complete
  - Prevents data leakage between test runs

#### 2. Missing Role Management Tools
- **Problem**: Role features in v0.2.0 weren't accessible via MCP tools
- **Solution**: Added 5 essential role management tools:
  - `list_roles` - List all available roles
  - `get_active_role` - Check current role for a project
  - `switch_role` - Change active role
  - `create_role_handoff` - Create transitions between roles
  - `get_role_handoffs` - View handoff history

### 📚 What's New

#### Complete Role Tool Suite
Now you can fully utilize the role-based features introduced in v0.2.0:

```
// List available roles
"List available roles"

// Check current role
"What's my current role for project my-app?"

// Switch roles
"Switch to developer role for my-app"

// Create handoffs
"Create a handoff to QA role with summary: Feature complete, ready for testing"

// View handoff history
"Show me role handoffs for my-app"
```

#### Test Isolation
- Tests now use temporary databases in system temp directory
- Each test suite gets a unique database instance
- No more manual cleanup needed between test runs
- Improved test reliability and speed

### 🔒 Technical Details

- Fixed import paths for better module resolution
- Updated error handling for role operations
- Improved type safety in tool responses
- Test databases use timestamp-based naming for uniqueness

### 📈 Testing

- All 148 tests passing
- Integration tests updated to use test isolation
- No breaking changes from v0.2.0

### 🚀 Upgrading

Simply update to v0.2.1:
```bash
npm install -g @briandawson/mcp-context-memory@0.2.1
```

The database schema remains unchanged from v0.2.0, so no migration needed.

### 🙏 Acknowledgments

Thanks to external testers who identified these issues and provided detailed feedback on the problems encountered during v0.2.0 testing.

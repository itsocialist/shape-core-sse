# DevOps Fix: MCP Server Package Names

## Issue Identified
The GitAdapter is trying to use `@modelcontextprotocol/server-git` which doesn't exist on npm.

## Solution
We have two options:

### Option 1: Use @cyanheads/git-mcp-server (Installed)
- Already installed globally
- Provides comprehensive Git operations
- Can be called directly as `git-mcp-server`

### Option 2: Find the correct modelcontextprotocol package
- The organization exists but doesn't have a git server
- They have `@modelcontextprotocol/server-github` for GitHub API

## Recommended Fix

Update `src/adapters/GitAdapter.ts` line 134:
```typescript
// OLD (doesn't exist):
args: ['-y', '@modelcontextprotocol/server-git'],

// NEW Option 1 - Use installed server directly:
command: 'git-mcp-server',
args: [],

// NEW Option 2 - Use via npx:
args: ['-y', '@cyanheads/git-mcp-server'],
```

## Next Steps
1. Patch the GitAdapter to use the correct package
2. Update test helper to check for the right package
3. Run integration tests to verify

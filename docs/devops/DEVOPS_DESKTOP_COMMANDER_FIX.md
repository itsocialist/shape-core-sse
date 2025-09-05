# DevOps Fix: Desktop Commander Tool Names

## Issue
The Desktop Commander MCP server uses different tool names than expected:
- Code expects: `desktop_mcp:execute_command`
- Server provides: `execute_command`

## Required Changes in TerminalAdapter.ts

1. Line 189: `desktop_mcp:execute_command` → `execute_command`
2. Line 266: `desktop_mcp:read_output` → `read_output`
3. Line 298: `desktop_mcp:list_sessions` → `list_sessions`
4. Line 348: `desktop_mcp:force_terminate` → `force_terminate`
5. Line 387: `desktop_mcp:execute_command` → `execute_command`
6. Line 438: `desktop_mcp:force_terminate` → `force_terminate`

## Applying the Fix

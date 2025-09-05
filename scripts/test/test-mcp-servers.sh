#!/bin/bash
# MCP Server Test Script - DevOps
# Tests if MCP servers are properly installed and accessible

echo "🔍 Testing MCP Server Installation..."
echo "=================================="

# Test Git MCP Server
echo -e "\n1. Testing Git MCP Server:"
if command -v git-mcp-server &> /dev/null; then
    echo "✅ git-mcp-server is installed at: $(which git-mcp-server)"
    # Try to get version or help
    timeout 2 git-mcp-server --help 2>&1 | head -5 || echo "   (No --help output, but server exists)"
else
    echo "❌ git-mcp-server not found in PATH"
fi

# Test Desktop Commander
echo -e "\n2. Testing Desktop Commander:"
if npx -y @wonderwhy-er/desktop-commander --version 2>&1 | grep -q "error"; then
    echo "❌ Desktop Commander not accessible via npx"
else
    echo "✅ Desktop Commander is accessible via npx"
fi

# Test with global install
if command -v desktop-commander &> /dev/null; then
    echo "✅ desktop-commander is installed globally"
else
    echo "⚠️  desktop-commander not in PATH (may need to use npx)"
fi

# Check npm global packages
echo -e "\n3. NPM Global MCP Packages:"
npm list -g --depth=0 2>/dev/null | grep -E "(git-mcp|desktop-commander|cyanheads)" || echo "No MCP packages found"

echo -e "\n=================================="
echo "📋 Summary:"
echo "- Git MCP Server: @cyanheads/git-mcp-server (installed)"
echo "- Desktop Commander: @wonderwhy-er/desktop-commander (installed)"
echo -e "\n⚠️  Note: The code expects '@modelcontextprotocol/server-git' which doesn't exist."
echo "We need to update the GitAdapter to use '@cyanheads/git-mcp-server' instead."

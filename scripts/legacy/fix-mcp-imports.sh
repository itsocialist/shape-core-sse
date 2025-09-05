#!/bin/bash

# Fix MCP SDK imports
echo "🔧 Fixing MCP SDK imports..."

find src -name "*.ts" -type f | while read file; do
    # Fix MCP SDK imports to include .js
    sed -i '' "s|from '@modelcontextprotocol/sdk/server/index'|from '@modelcontextprotocol/sdk/server/index.js'|g" "$file"
    sed -i '' "s|from '@modelcontextprotocol/sdk/server/stdio'|from '@modelcontextprotocol/sdk/server/stdio.js'|g" "$file"
    sed -i '' "s|from '@modelcontextprotocol/sdk/client/index'|from '@modelcontextprotocol/sdk/client/index.js'|g" "$file"
    sed -i '' "s|from '@modelcontextprotocol/sdk/client/stdio'|from '@modelcontextprotocol/sdk/client/stdio.js'|g" "$file"
    sed -i '' "s|from '@modelcontextprotocol/sdk/types'|from '@modelcontextprotocol/sdk/types.js'|g" "$file"
done

echo "✅ MCP SDK imports fixed!"

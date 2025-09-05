#!/bin/bash

# MCP Context Memory Server Startup Script
# This script ensures the correct Node.js version is used

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use Node v20
nvm use 20

# Change to the project directory
cd "$(dirname "$0")"

# Rebuild native modules if needed
if [ ! -f ".modules_built_for_v20" ]; then
    echo "Rebuilding native modules for Node v20..." >&2
    npm rebuild better-sqlite3
    touch .modules_built_for_v20
fi

# Start the server
exec node dist/index.js

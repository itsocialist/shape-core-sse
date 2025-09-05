#!/bin/bash

# Fix all TypeScript imports to add .js extensions
# This handles the NodeNext module resolution requirement

echo "🔧 Fixing TypeScript imports for NodeNext module resolution..."

# Function to fix imports in a file
fix_imports() {
    local file=$1
    echo "  Fixing: $file"
    
    # Fix relative imports that don't already have .js
    # Match: from './something' or from '../something' but not if already has .js
    sed -i '' -E "s/from '(\.\.[^']+)'/from '\1.js'/g" "$file"
    sed -i '' -E "s/from '(\.\/[^']+)'/from '\1.js'/g" "$file"
    
    # Don't add .js to imports that already have it
    sed -i '' -E "s/\.js\.js'/\.js'/g" "$file"
    
    # Don't add .js to node_modules imports
    sed -i '' -E "s/from '(@[^']+)\.js'/from '\1'/g" "$file"
    sed -i '' -E "s/from '([a-zA-Z][^'./@]+)\.js'/from '\1'/g" "$file"
}

# Fix all TypeScript files
find src -name "*.ts" -type f | while read file; do
    fix_imports "$file"
done

echo "✅ Import fixes complete!"

#!/bin/bash

# Fix all missing .js extensions in imports
find src -name "*.ts" -type f | while read file; do
  # Fix relative imports that don't have .js extension
  sed -i '' -E "s/from '(\.\.[^']+)'/from '\1.js'/g" "$file"
  sed -i '' -E "s/from '(\.[^']+)'/from '\1.js'/g" "$file"
done

echo "Fixed .js extensions in imports"

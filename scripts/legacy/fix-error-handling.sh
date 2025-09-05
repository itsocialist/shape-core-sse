#!/bin/bash

# Fix error handling with proper type guards
echo "🔧 Fixing error handling..."

# Fix all error handling in catch blocks
find src -name "*.ts" -type f | while read file; do
    # Replace error.message with proper type guard
    sed -i '' 's/error\.message/error instanceof Error ? error.message : String(error)/g' "$file"
done

echo "✅ Error handling fixed!"

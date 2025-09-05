#!/bin/bash

# Fix error handling in catch blocks
find src -name "*.ts" -type f | while read file; do
  # Fix error.message where error is unknown type
  sed -i '' 's/error\.message/error instanceof Error ? error.message : "Unknown error"/g' "$file"
done

echo "Fixed error handling"

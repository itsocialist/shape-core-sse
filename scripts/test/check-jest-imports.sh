#!/bin/bash

# Find test files without proper jest imports
echo "Checking for test files without proper jest imports..."

# Get all test files
ALL_TEST_FILES=$(grep -r "describe(" tests/ -l | sort)

# Get files with jest imports
FILES_WITH_IMPORTS=$(grep -r "from.*@jest/globals" tests/ -l | sort)

# Find the difference
echo "Test files missing jest imports:"
echo "================================"

for file in $ALL_TEST_FILES; do
  if ! echo "$FILES_WITH_IMPORTS" | grep -q "$file"; then
    echo "❌ $file"
  fi
done

echo ""
echo "Test files with proper imports:"
echo "==============================="
count=0
for file in $FILES_WITH_IMPORTS; do
  echo "✅ $file"
  count=$((count + 1))
done

echo ""
echo "Summary: $count files have proper imports"

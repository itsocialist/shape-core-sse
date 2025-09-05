#!/bin/bash

# Test runner script for MPCM-Pro

echo "Running MPCM-Pro tests..."
echo "========================="

# Set environment for ESM
export NODE_OPTIONS='--experimental-vm-modules'

# Run tests with no coverage to speed up
npx jest --no-coverage --verbose "$@"

# Capture exit code
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo ""
  echo "✅ All tests passed!"
else
  echo ""
  echo "❌ Some tests failed. Exit code: $EXIT_CODE"
fi

exit $EXIT_CODE

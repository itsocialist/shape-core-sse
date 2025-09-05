#!/bin/bash
# MPCM-Pro Functional Test Suite - Manual Execution
# QA Engineer: Testing v0.3.0 consolidated build

echo "=== MPCM-Pro v0.3.0 Functional Testing ==="
echo "Started: $(date)"
echo ""

# Test Environment Setup
TEST_DIR="/tmp/mpcm-pro-qa-test"
TEST_DB="$TEST_DIR/test.db"
CLAUDE_CONFIG="$HOME/Library/Application Support/Claude/claude_desktop_config.json"

# Create test directory
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

echo "Test Directory: $TEST_DIR"
echo "Current Directory: $(pwd)"
echo ""

# Test 1: Check if build works
echo "=== Test 1: Build Verification ==="
cd /Users/briandawson/Development/mpcm-pro
npm run build
BUILD_STATUS=$?
echo "Build status: $BUILD_STATUS"
echo ""

# Test 2: Check if we can run in Basic mode
echo "=== Test 2: Basic Mode Startup ==="
MPCM_BASIC_MODE=true timeout 5 npm run dev > basic-mode-test.log 2>&1 &
BASIC_PID=$!
sleep 3
if ps -p $BASIC_PID > /dev/null; then
    echo "✅ Basic mode started successfully"
    kill $BASIC_PID
else
    echo "❌ Basic mode failed to start"
fi
echo ""

# Test 3: Check if we can run in Pro mode
echo "=== Test 3: Pro Mode Startup ==="
timeout 5 npm run dev > pro-mode-test.log 2>&1 &
PRO_PID=$!
sleep 3
if ps -p $PRO_PID > /dev/null; then
    echo "✅ Pro mode started successfully"
    kill $PRO_PID
else
    echo "❌ Pro mode failed to start"
fi
echo ""

# Test 4: Check Claude Desktop config
echo "=== Test 4: Claude Desktop Configuration ==="
if [ -f "$CLAUDE_CONFIG" ]; then
    echo "✅ Claude config exists"
    echo "Current mpcm entries:"
    grep -A5 -B5 "mpcm" "$CLAUDE_CONFIG" || echo "No mpcm entries found"
else
    echo "❌ Claude config not found at: $CLAUDE_CONFIG"
fi
echo ""

echo "=== Initial Test Complete ==="
echo "Completed: $(date)"

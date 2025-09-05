#!/bin/bash
# Rust build and test script for MPCM-Pro

# Add cargo to PATH
export PATH="$HOME/.cargo/bin:$PATH"

cd /Users/briandawson/Development/mpcm-pro/mpcm-service

echo "🦀 Running Rust build check..."
cargo check

echo ""
echo "🧪 Running tests..."
cargo test

echo ""
echo "✅ Build and test complete!"

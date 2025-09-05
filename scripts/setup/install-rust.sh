#!/bin/bash
# MPCM-Pro Rust Installation Script
# DevOps Engineer: Sprint 3 Unblock

set -e

echo "🚀 MPCM-Pro Sprint 3: Rust Installation"
echo "========================================"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if Rust is already installed
if command_exists rustc && command_exists cargo; then
    echo "✅ Rust is already installed!"
    echo "   rustc version: $(rustc --version)"
    echo "   cargo version: $(cargo --version)"
    echo ""
    echo "Skipping installation..."
else
    echo "📦 Installing Rust..."
    echo ""
    
    # Install Rust using rustup
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    
    # Add Rust to current shell session
    source "$HOME/.cargo/env"
    
    echo ""
    echo "✅ Rust installed successfully!"
fi

# Check for SQLite and pkg-config (needed for sqlx)
echo ""
echo "📦 Checking dependencies..."

if command_exists brew; then
    # Install SQLite and pkg-config if not present
    if ! brew list sqlite3 &>/dev/null; then
        echo "Installing SQLite3..."
        brew install sqlite3
    else
        echo "✅ SQLite3 already installed"
    fi
    
    if ! brew list pkg-config &>/dev/null; then
        echo "Installing pkg-config..."
        brew install pkg-config
    else
        echo "✅ pkg-config already installed"
    fi
else
    echo "⚠️  Homebrew not found. Please install SQLite3 and pkg-config manually."
fi

# Verify installation
echo ""
echo "🔍 Verifying installation..."

if command_exists rustc && command_exists cargo; then
    echo "✅ Rust installation verified"
    echo "   rustc version: $(rustc --version)"
    echo "   cargo version: $(cargo --version)"
    
    # Test compilation
    echo ""
    echo "🧪 Testing Rust compilation..."
    
    # Navigate to mpcm-service directory if it exists
    if [ -d "/Users/briandawson/Development/mpcm-pro/mpcm-service" ]; then
        cd /Users/briandawson/Development/mpcm-pro/mpcm-service
        echo "📂 Found mpcm-service directory"
        echo ""
        echo "🏗️  Running cargo check..."
        cargo check
        echo ""
        echo "✅ Rust service is ready to compile!"
        echo ""
        echo "🎯 Next steps:"
        echo "   1. Run tests: cargo test"
        echo "   2. Build release: cargo build --release"
        echo "   3. Run benchmarks: cargo bench"
    else
        echo "⚠️  mpcm-service directory not found"
        echo "   Expected at: /Users/briandawson/Development/mpcm-pro/mpcm-service"
    fi
else
    echo "❌ Rust installation failed!"
    echo "   Please run the installation manually:"
    echo "   curl --proto='=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

echo ""
echo "🎉 Sprint 3 is now UNBLOCKED!"
echo "================================"
echo ""
echo "To use Rust in your current shell, run:"
echo "source $HOME/.cargo/env"

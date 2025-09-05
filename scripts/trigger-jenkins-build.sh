#!/bin/bash

# Jenkins Build Trigger Script
# Created: June 25, 2025

set -e

echo "🔨 MPCM-Pro Jenkins Build Trigger"
echo "================================="

# Check if Jenkins is running
if ! curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo "❌ Jenkins is not running. Start it with:"
    echo "   brew services start jenkins-lts"
    exit 1
fi

# Configuration
JENKINS_URL="http://localhost:8080"
JOB_NAME="mpcm-pro-adapter-pipeline"

# Function to trigger build via CLI
trigger_build_cli() {
    echo "🚀 Triggering build via Jenkins CLI..."
    
    jenkins-cli build "$JOB_NAME" -s "$JENKINS_URL" || {
        echo "❌ Failed to trigger build. Make sure:"
        echo "   1. Jenkins is running at $JENKINS_URL"
        echo "   2. Job '$JOB_NAME' exists"
        echo "   3. You have proper permissions"
        exit 1
    }
}

# Function to trigger build via curl (if API token is set)
trigger_build_api() {
    echo "🚀 Triggering build via API..."
    
    # Check for credentials
    if [ -z "$JENKINS_USER" ] || [ -z "$JENKINS_TOKEN" ]; then
        echo "❌ JENKINS_USER and JENKINS_TOKEN environment variables not set"
        echo "   Set them in your shell:"
        echo "   export JENKINS_USER=your-username"
        echo "   export JENKINS_TOKEN=your-api-token"
        echo ""
        echo "   To get API token: Jenkins → User → Configure → API Token"
        return 1
    fi
    
    curl -X POST "$JENKINS_URL/job/$JOB_NAME/build" \
         --user "$JENKINS_USER:$JENKINS_TOKEN"
}

# Function to check build status
check_status() {
    echo ""
    echo "📊 Checking build status..."
    
    if [ -n "$JENKINS_USER" ] && [ -n "$JENKINS_TOKEN" ]; then
        curl -s "$JENKINS_URL/job/$JOB_NAME/lastBuild/api/json" \
             --user "$JENKINS_USER:$JENKINS_TOKEN" | \
             jq -r '.result, .url' 2>/dev/null || \
             echo "Install jq for pretty output: brew install jq"
    else
        echo "View build at: $JENKINS_URL/job/$JOB_NAME"
    fi
}

# Main execution
case "${1:-cli}" in
    api)
        trigger_build_api
        ;;
    cli)
        trigger_build_cli
        ;;
    status)
        check_status
        ;;
    *)
        echo "Usage: $0 [cli|api|status]"
        echo "  cli    - Trigger via Jenkins CLI (default)"
        echo "  api    - Trigger via REST API (requires JENKINS_USER and JENKINS_TOKEN)"
        echo "  status - Check last build status"
        exit 1
        ;;
esac

if [ "$1" != "status" ]; then
    echo ""
    echo "✅ Build triggered successfully!"
    echo "   Monitor at: $JENKINS_URL/job/$JOB_NAME"
fi

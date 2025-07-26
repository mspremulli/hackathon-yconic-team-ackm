#!/bin/bash

echo "🚀 Starting Temporal in development mode..."
echo ""
echo "This will start a local Temporal server with:"
echo "- In-memory database"
echo "- Web UI at http://localhost:8233"
echo "- Server at localhost:7233"
echo ""

# Check if temporal CLI is installed
if ! command -v temporal &> /dev/null; then
    echo "❌ Temporal CLI not found!"
    echo ""
    echo "Please install it with:"
    echo "  curl -sSf https://temporal.download/cli.sh | sh"
    echo "  export PATH=\"\$PATH:\$HOME/.temporalio/bin\""
    exit 1
fi

# Start Temporal in dev mode
temporal server start-dev
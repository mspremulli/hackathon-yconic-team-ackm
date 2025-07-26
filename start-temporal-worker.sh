#!/bin/bash

echo "🚀 Starting Temporal Worker..."
echo "📋 Task Queue: startup-analysis-queue"
echo ""

# Compile TypeScript first
echo "📦 Compiling TypeScript..."
npm run build

# Check if Temporal is running
if ! nc -z localhost 7233 2>/dev/null; then
    echo "⚠️  Warning: Temporal server doesn't seem to be running on localhost:7233"
    echo "   You can start it with: temporal server start-dev"
    echo ""
fi

# Start the worker
echo "🔧 Starting worker..."
node dist/temporal/worker.js
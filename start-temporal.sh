#!/bin/bash

echo "🚀 Starting Temporal Development Server..."
echo ""
echo "This will start:"
echo "- Temporal Server at localhost:7233"
echo "- Temporal Web UI at http://localhost:8233"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start Temporal in development mode
temporal server start-dev
#!/bin/bash

# Test the MCP server
echo "Testing MCP Server..."

# Create a simple test request
cat > test-request.json << EOF
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
EOF

# Run the server and send the test request
echo "Sending test request to list tools..."
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npm run mcp

# Clean up
rm -f test-request.json
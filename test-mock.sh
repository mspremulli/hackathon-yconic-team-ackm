#!/bin/bash

echo "=== Social Media MCP Test Script ==="
echo "Testing with mock data (no API keys required)"
echo ""

# Test 1: List all tools
echo "1. Listing available tools:"
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npm run mcp 2>/dev/null | grep -A 200 '"tools"' | head -20

echo -e "\n2. Testing sentiment analysis:"
cat << EOF | npm run mcp 2>/dev/null | grep -A 50 "content"
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "sentiment_analysis",
    "arguments": {
      "texts": [
        "This product is absolutely amazing! Best investment ever.",
        "Terrible experience, would not recommend to anyone.",
        "It's okay, has some good features but also issues."
      ]
    }
  }
}
EOF

echo -e "\n3. Testing smart name matching:"
# This will show the variations generated
cat << EOF | npm run mcp 2>/dev/null | grep -A 20 "content"
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "twitter_search",
    "arguments": {
      "query": "Open AI",
      "limit": 5,
      "smartMatch": true,
      "website": "openai.com"
    }
  }
}
EOF

echo -e "\nTest complete!"
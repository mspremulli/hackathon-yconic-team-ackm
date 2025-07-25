#!/usr/bin/env node

/**
 * Test script for Social Media MCP Server
 * This simulates MCP client requests
 */

import { spawn } from 'child_process';
import readline from 'readline';

// Create interface for reading stdin
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Start the MCP server
console.log('Starting MCP server...');
const server = spawn('npm', ['run', 'mcp'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

// Helper to send JSON-RPC request
function sendRequest(method, params = {}) {
  const request = {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params
  };
  
  server.stdin.write(JSON.stringify(request) + '\n');
}

// Handle server output
server.stdout.on('data', (data) => {
  try {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      try {
        const response = JSON.parse(line);
        console.log('\nServer Response:', JSON.stringify(response, null, 2));
      } catch (e) {
        // Not JSON, just log it
        if (line.trim()) console.log('Server:', line);
      }
    });
  } catch (error) {
    console.log('Server output:', data.toString());
  }
});

// Test sequence
async function runTests() {
  console.log('\n=== MCP Server Test Suite ===\n');
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('1. Testing tools/list...');
  sendRequest('tools/list');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\n2. Testing sentiment analysis on sample text...');
  sendRequest('tools/call', {
    name: 'sentiment_analysis',
    arguments: {
      text: "OpenAI's ChatGPT is amazing! It has completely transformed how I work. The API is fast and reliable.",
      deepAnalysis: true
    }
  });
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('\n3. Testing Twitter search with smart matching...');
  sendRequest('tools/call', {
    name: 'twitter_search',
    arguments: {
      query: 'OpenAI',
      limit: 10,
      smartMatch: true,
      website: 'openai.com'
    }
  });
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('\n4. Testing comprehensive startup analysis...');
  sendRequest('tools/call', {
    name: 'analyze_startup',
    arguments: {
      startup_name: 'Anthropic',
      website: 'anthropic.com',
      keywords: ['Claude', 'AI safety'],
      social_accounts: {
        twitter: 'AnthropicAI'
      }
    }
  });
  
  // Keep running for comprehensive analysis
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  console.log('\n5. Testing dashboard summary...');
  sendRequest('tools/call', {
    name: 'dashboard_summary',
    arguments: {
      startup_name: 'Anthropic',
      time_range: '7d'
    }
  });
  
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('\n\nTests complete! Press Ctrl+C to exit.');
}

// Run tests
runTests().catch(console.error);

// Handle exit
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.kill();
  process.exit(0);
});
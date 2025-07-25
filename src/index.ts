import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';

// Import tools
import { twitterSearchTool } from './tools/twitter.js';
import { blueskySearchTool } from './tools/bluesky.js';
import { youtubeSearchTool } from './tools/youtube.js';
import { redditSearchTool } from './tools/reddit.js';
import { 
  tavilyWebSearchTool, 
  tavilyLinkedInSearchTool, 
  tavilyNewsSearchTool, 
  tavilyTechSearchTool 
} from './tools/tavily.js';
import { brightDataSearchTool, brightDataSocialProfileTool } from './tools/brightdata.js';
import { sentimentAnalysisTool } from './tools/sentiment.js';
import { startupAnalysisTool } from './tools/startup-analysis.js';
import { dashboardSummaryTool } from './tools/dashboard.js';

// Import resources
import { startupDataResource } from './resources/startup-data.js';

// Import prompts
import { startupAnalysisPrompt } from './prompts/startup-analysis.js';

dotenv.config();

// Initialize MCP server
const server = new Server(
  {
    name: 'startup-sentiment-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// All available tools
const tools = [
  twitterSearchTool,
  blueskySearchTool,
  youtubeSearchTool,
  redditSearchTool,
  tavilyWebSearchTool,
  tavilyLinkedInSearchTool,
  tavilyNewsSearchTool,
  tavilyTechSearchTool,
  brightDataSearchTool,
  brightDataSocialProfileTool,
  sentimentAnalysisTool,
  startupAnalysisTool,
  dashboardSummaryTool,
];

// All available resources
const resources = [
  startupDataResource,
];

// All available prompts
const prompts = [
  startupAnalysisPrompt,
];

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

// Handle call tool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = tools.find(t => t.name === request.params.name);
  
  if (!tool) {
    throw new Error(`Tool not found: ${request.params.name}`);
  }
  
  try {
    const result = await tool.handler(request.params.arguments);
    return {
      content: [
        {
          type: 'text',
          text: result,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Tool execution failed: ${errorMessage}`);
  }
});

// Handle list resources request
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: resources.map(resource => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
    })),
  };
});

// Handle read resource request
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resource = resources.find(r => r.uri === request.params.uri);
  
  if (!resource) {
    throw new Error(`Resource not found: ${request.params.uri}`);
  }
  
  const content = await resource.handler();
  return {
    contents: [
      {
        uri: resource.uri,
        mimeType: resource.mimeType,
        text: content,
      },
    ],
  };
});

// Handle list prompts request
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: prompts.map(prompt => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments,
    })),
  };
});

// Handle get prompt request
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const prompt = prompts.find(p => p.name === request.params.name);
  
  if (!prompt) {
    throw new Error(`Prompt not found: ${request.params.name}`);
  }
  
  const messages = await prompt.handler(request.params.arguments || {});
  return {
    description: prompt.description,
    messages,
  };
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Startup Sentiment MCP Server running...');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
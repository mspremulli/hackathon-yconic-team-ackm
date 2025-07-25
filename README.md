# Startup Sentiment MCP Server

A Model Context Protocol (MCP) server for comprehensive startup analysis through social media scraping, sentiment analysis, and market insights. Built for the AWS Enterprise AI Hackathon 2025.

## Features

- **Multi-Platform Social Media Scraping**
  - Twitter/X scraping via Bright Data (no expensive API needed!)
  - Bluesky AT Protocol support
  - YouTube Data API for video analysis
  - Reddit scraping via Bright Data (multi-subreddit)
  - Instagram & TikTok scraping (Bright Data)

- **Advanced Web Intelligence**
  - Tavily API for targeted web search
  - Bright Data for dynamic content scraping
  - LinkedIn company and founder profiling
  - News and tech community monitoring

- **AI-Powered Analysis**
  - Hybrid sentiment analysis:
    - Mistral (AWS Bedrock) for bulk processing
    - Claude (AWS Bedrock) for deep insights on key posts
  - Aspect-based sentiment extraction
  - Business implication analysis
  - Smart name matching & variation detection

- **Data Management**
  - MongoDB for data persistence
  - Real-time aggregation and analytics
  - Historical trend tracking
  - Senso.ai integration ready

- **Enterprise Features**
  - Executive dashboard summaries
  - Competitive landscape analysis
  - VC-focused metrics (traction, sentiment, reach)
  - Temporal-ready architecture

## Quick Start

1. Clone and install:
```bash
npm install
```

2. Copy `.env.example` to `.env` and add your API keys:
```bash
cp .env.example .env
```

3. Run the MCP server:
```bash
npm run mcp
```

## Available Tools

### `analyze_startup`
Comprehensive startup analysis across all data sources.
```typescript
{
  startup_name: "Acme Corp",
  website: "https://acme.com",
  social_accounts: {
    twitter: "acmecorp",
    linkedin: "company/acme"
  },
  founders: [{
    name: "Jane Doe",
    twitter: "janedoe"
  }],
  keywords: ["AI", "enterprise"],
  competitors: ["CompetitorA", "CompetitorB"]
}
```

### `twitter_search`
Search Twitter/X for mentions and discussions.

### `bluesky_search`
Search Bluesky for tech community insights.

### `youtube_search`
Find product demos, reviews, and founder talks.

### `reddit_search`
Search Reddit discussions across tech and startup subreddits with smart matching.

### `tavily_web_search`
General web search with AI-powered summaries.

### `brightdata_scrape`
Advanced web scraping for dynamic content.

### `sentiment_analysis`
Analyze sentiment using hybrid approach - Mistral for all posts, Claude for deep insights.
```typescript
{
  startup_name: "OpenAI",
  deepAnalysis: true  // Enable Claude analysis on key posts
}
```

### `dashboard_summary`
Generate comprehensive dashboard reports.

## Resources

### `startup-sentiment://data/recent`
Access recent startup analyses and sentiment data from MongoDB.

## Prompts

### `analyze_startup_prompt`
Generate comprehensive analysis prompts for specific startups.

## Configuration

### Required API Keys

- **Social Media**
  - `TWITTER_BEARER_TOKEN` - Twitter API v2
  - `BLUESKY_HANDLE` + `BLUESKY_APP_PASSWORD` - Bluesky auth
  - `YOUTUBE_API_KEY` - YouTube Data API v3

- **Web Intelligence**
  - `TAVILY_API_KEY` - Tavily search API
  - `BRIGHT_DATA_API_KEY` + `BRIGHT_DATA_CUSTOMER_ID` - Bright Data

- **AI/ML**
  - AWS credentials for Bedrock
  - `MINIMAX_API_KEY` + `MINIMAX_GROUP_ID` (optional)

- **Database**
  - `MONGODB_URI` - MongoDB connection string

## Usage with Claude Desktop

1. Add to Claude Desktop config:
```json
{
  "mcpServers": {
    "startup-sentiment": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/path/to/aws-hackathon-07-25-2025"
    }
  }
}
```

2. Restart Claude Desktop

3. Use the tools:
```
Please analyze the startup "OpenAI" and provide investment insights.
```

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   MCP Client    │────▶│  MCP Server  │────▶│   MongoDB   │
│ (Claude Desktop)│     │ (TypeScript) │     │             │
└─────────────────┘     └──────┬───────┘     └─────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
         ┌──────▼──────┐              ┌───────▼──────┐
         │ Social APIs │              │  Web Search  │
         │ Twitter     │              │  Tavily      │
         │ Bluesky     │              │  Bright Data │
         │ YouTube     │              └──────────────┘
         └─────────────┘
                │
         ┌──────▼──────┐
         │ Sentiment   │
         │ Analysis    │
         │ (Bedrock)   │
         └─────────────┘
```

## Development

```bash
# Run in development mode
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start
```

## Temporal Integration (Future)

The server is designed to integrate with Temporal for:
- Durable workflow execution
- Retry handling for API failures
- Long-running analysis tasks
- Scheduled monitoring

## License

MIT
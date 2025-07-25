# Startup Sentiment Dashboard

A simple web dashboard for visualizing startup sentiment analysis from social media data.

## Features

- 🔍 Real-time startup analysis
- 📊 Sentiment visualization (Positive/Negative/Neutral)
- 📱 Social media activity metrics
- 💬 Recent mentions display
- 📈 Engagement metrics

## Quick Start

1. Start the dashboard server:
```bash
npm run dashboard
```

2. Open your browser to:
```
http://localhost:3456
```

3. Enter a startup name and click "Analyze"

## How it Works

The dashboard connects to your MCP server data and displays:
- Overall sentiment analysis
- Social media activity metrics
- Recent posts and mentions
- Executive summary

## API Endpoints

- `GET /analyze/:startup` - Get analysis for a startup
- `GET /health` - Health check

## Customization

Edit `index.html` to customize the UI styling and layout.

## Requirements

- Node.js 18+
- MongoDB running with data from MCP server
- MCP server tools available
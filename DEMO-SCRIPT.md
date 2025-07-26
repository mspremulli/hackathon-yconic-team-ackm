# AWS Hackathon Demo Script

## Overview
Demonstrate a comprehensive startup analysis platform using AWS services, Temporal workflows, and AI-powered sentiment analysis.

## Demo Flow

### 1. Introduction (1 minute)
"We've built a comprehensive startup intelligence platform that analyzes social media sentiment across all major platforms - Twitter, Reddit, TikTok, Instagram, YouTube, and more."

**Key Points:**
- Real-time social media analysis
- AI-powered sentiment analysis using AWS Bedrock
- Durable workflows with Temporal
- MongoDB for data persistence

### 2. Basic Analysis Demo (2 minutes)

```bash
# Analyze a well-known startup
analyze_startup startup_name="OpenAI" website="https://openai.com"
```

**Show:**
- Multi-platform data collection
- Engagement metrics
- Sentiment analysis results
- Data saved to MongoDB

### 3. Temporal Workflow Demo (3 minutes)

```bash
# Start a durable analysis with Temporal
analyze_startup_temporal startup_name="Anthropic" wait_for_result=false
```

**Show Temporal UI (http://localhost:8233):**
- Workflow starting
- Activities executing in parallel
- Automatic retries on failures
- Complete audit trail

**Benefits to highlight:**
- Survives system crashes
- Automatic retry with exponential backoff
- Perfect for long-running analyses
- Complete visibility into execution

### 4. Advanced Features (2 minutes)

#### A. Continuous Monitoring
```bash
# Monitor a startup every hour for 24 hours
monitor_startup_temporal startup_name="Perplexity" interval="1h" duration="24h"
```

#### B. AI-Powered Summaries with Senso.ai
```bash
# Generate executive summary
senso_summary startup_name="OpenAI" summary_type="executive"
```

#### C. Visual Platforms (TikTok/Instagram)
```bash
# Search TikTok and Instagram
tiktok_search query="AI startup" limit=20
instagram_search query="techstartup" type="hashtag"
```

### 5. Architecture Highlights (2 minutes)

**AWS Services Used:**
- **AWS Bedrock**: Claude & Mistral for sentiment analysis
- **AWS SDK**: Infrastructure and API access
- **MongoDB Atlas**: Data persistence
- **Temporal**: Workflow orchestration

**Key Differentiators:**
- Smart name matching across platforms
- Batch sentiment analysis for efficiency
- Rate limiting with automatic backoff
- Comprehensive platform coverage

### 6. Business Value (1 minute)

**Use Cases:**
- **VCs**: Track portfolio companies' market sentiment
- **Founders**: Monitor brand perception
- **Competitors**: Understand market positioning
- **Marketing**: Measure campaign effectiveness

**Metrics Provided:**
- Engagement rates
- Sentiment trends
- Platform distribution
- Influencer mentions

### 7. Live Q&A Demo (2 minutes)

Be ready to analyze any startup the judges suggest:
```bash
# Quick analysis
analyze_startup startup_name="[Judge's Choice]"

# With Temporal for reliability
analyze_startup_temporal startup_name="[Judge's Choice]" wait_for_result=true
```

## Demo Commands Cheat Sheet

### Essential Commands
```bash
# Basic analysis
analyze_startup startup_name="Tesla"

# Temporal workflow
analyze_startup_temporal startup_name="SpaceX"

# Check workflow status
check_temporal_workflow workflow_id="startup-analysis-SpaceX-[timestamp]"

# Get results
get_temporal_workflow_result workflow_id="startup-analysis-SpaceX-[timestamp]"

# Generate AI summary
senso_summary startup_name="Tesla"

# Platform-specific searches
twitter_search query="OpenAI" limit=50
tiktok_search query="AI startup" limit=30
instagram_search query="techstartup" type="hashtag"
reddit_search query="startup advice" subreddit="startups"
```

### Dashboard
```bash
# Start dashboard (separate terminal)
npm run dashboard

# Open http://localhost:3456
```

## Key Messages

1. **Comprehensive Coverage**: All major social platforms in one place
2. **Enterprise-Grade**: Temporal ensures reliability and durability
3. **AI-Powered**: AWS Bedrock for intelligent analysis
4. **Real-Time**: Live data from multiple sources
5. **Scalable**: Built on AWS infrastructure

## Troubleshooting

### If Temporal isn't working:
- Show the direct analysis tool instead
- Emphasize the architecture and potential

### If API rate limits hit:
- Explain the intelligent rate limiting
- Show cached results
- Demonstrate the retry mechanism

### If no data for a startup:
- Use a well-known startup (OpenAI, Tesla, Anthropic)
- Show the smart name matching feature
- Explain how it handles new/small startups

## Closing
"This platform democratizes access to comprehensive market intelligence, enabling better investment decisions and strategic planning for the startup ecosystem."
# Senso.ai Integration Guide

## Overview

This project includes integration with Senso.ai for generating AI-powered summaries of startup analysis data. The integration creates concise, actionable summaries and stores them in MongoDB for future reference.

## Features

- **Multiple Summary Types**: Executive, detailed, sentiment-focused, or competitive analysis
- **Source Filtering**: Choose which data sources to include in summaries
- **MongoDB Storage**: All summaries are saved to a dedicated collection
- **Fallback Support**: Basic summaries if Senso.ai is unavailable
- **Batch Processing**: Efficiently summarize multiple analyses

## Setup

### 1. Get Senso.ai API Key

1. Visit [https://senso.ai](https://senso.ai)
2. Sign up for an account
3. Navigate to API Keys section
4. Generate a new API key

### 2. Configure Environment

Add your API key to `.env`:
```env
SENSO_API_KEY=your_senso_api_key_here
```

## Available Tools

### `senso_summary`
Generate AI-powered summary of startup data.

**Parameters:**
- `startup_name` (required): Name of the startup
- `analysis_id` (optional): Specific analysis to summarize
- `include_sources` (optional): Array of sources to include
  - Options: `twitter`, `reddit`, `tiktok`, `instagram`, `youtube`, `bluesky`, `news`, `web`
- `summary_type` (optional): Type of summary
  - Options: `executive`, `detailed`, `sentiment`, `competitive`
  - Default: `executive`

**Example:**
```
senso_summary startup_name="OpenAI" summary_type="executive"
```

### `get_senso_summaries`
Retrieve previously generated summaries.

**Parameters:**
- `startup_name` (required): Startup name
- `limit` (optional): Number of summaries to retrieve (default: 5)

**Example:**
```
get_senso_summaries startup_name="OpenAI" limit=3
```

## Summary Types

### Executive Summary
- Overall market presence and traction
- Social media engagement metrics
- Key strengths and opportunities
- Recommended next steps

### Detailed Summary
- Platform-by-platform breakdown
- Engagement metrics and trends
- Content themes and messaging
- Audience demographics

### Sentiment Summary
- Overall sentiment distribution
- Key positive/negative themes
- Influencer opinions
- Reputation management insights

### Competitive Summary
- Market positioning
- Unique value propositions
- Industry comparisons
- Growth opportunities

## MongoDB Schema

Summaries are stored in the `social_senso_summaries` collection (note: automatically prefixed with `social_`):

```javascript
{
  startup_name: String,
  analysis_id: String,
  summary_type: String,
  sources_included: Array,
  generated_at: Date,
  senso_response: Object,
  summary_text: String,
  key_insights: Array,
  recommendations: Array,
  data_statistics: {
    total_posts_analyzed: Number,
    platforms_covered: Array,
    data_sources: Number
  },
  metrics: Object,
  is_fallback: Boolean // True if Senso.ai was unavailable
}
```

## Usage Examples

### Generate Executive Summary
```
senso_summary startup_name="Anthropic"
```

### Generate Sentiment-Focused Summary
```
senso_summary startup_name="Anthropic" summary_type="sentiment"
```

### Summary with Specific Sources
```
senso_summary startup_name="Anthropic" include_sources=["twitter", "reddit", "news"]
```

### Retrieve Historical Summaries
```
get_senso_summaries startup_name="Anthropic"
```

## Integration Flow

1. **Data Collection**: Fetches latest analysis from `startup_analyses` collection
2. **Social Metrics**: Aggregates posts from `social_posts` collection
3. **AI Processing**: Sends data to Senso.ai for summarization
4. **Storage**: Saves summary to `senso_summaries` collection
5. **Response**: Returns formatted summary to user

## Rate Limits

- Senso.ai basic tier: 100 requests/day
- Implement caching to avoid duplicate summaries
- Use fallback summaries when rate limited

## Error Handling

- **401 Unauthorized**: Check API key configuration
- **429 Rate Limited**: Wait or use fallback summary
- **Network Errors**: Automatic fallback to basic summary

## Best Practices

1. **Cache Summaries**: Avoid regenerating identical summaries
2. **Batch Processing**: Summarize multiple startups efficiently
3. **Source Selection**: Choose relevant sources for focused summaries
4. **Regular Updates**: Generate new summaries as data changes

## Monitoring

Check summary generation status:
```bash
# View recent summaries
db.senso_summaries.find().sort({generated_at: -1}).limit(10)

# Check error rates
db.senso_summaries.find({is_fallback: true}).count()
```

## Troubleshooting

### API Key Issues
- Verify key in `.env` file
- Check key permissions on Senso.ai dashboard

### Empty Summaries
- Ensure startup has been analyzed first
- Check MongoDB connectivity
- Verify data exists in source collections

### Rate Limiting
- Monitor daily usage
- Implement request queuing
- Use caching for repeated requests
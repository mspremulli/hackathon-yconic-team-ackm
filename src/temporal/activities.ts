import { Context } from '@temporalio/activity';
import { twitterSearchTool } from '../tools/twitter.js';
import { blueskySearchTool } from '../tools/bluesky.js';
import { youtubeSearchTool } from '../tools/youtube.js';
import { redditSearchTool } from '../tools/reddit.js';
import { tiktokSearchTool } from '../tools/tiktok.js';
import { instagramSearchTool } from '../tools/instagram.js';
import { 
  tavilyWebSearchTool, 
  tavilyLinkedInSearchTool, 
  tavilyNewsSearchTool, 
  tavilyTechSearchTool 
} from '../tools/tavily.js';
import { sentimentAnalysisTool } from '../tools/sentiment.js';
import { saveToMongoDB } from '../services/mongodb.js';
import type { 
  DataFetchParams, 
  SentimentAnalysisParams, 
  DatabaseSaveParams 
} from './types.js';

// Twitter data fetch activity
export async function fetchTwitterData(params: DataFetchParams): Promise<string> {
  const { heartbeat } = Context.current();
  
  try {
    heartbeat({ message: 'Fetching Twitter data...' });
    
    const result = await twitterSearchTool.handler({
      query: params.query,
      limit: params.limit || 100,
      smartMatch: params.smartMatch || false,
      website: params.website
    });
    
    heartbeat({ message: 'Twitter data fetched successfully' });
    return result;
  } catch (error: any) {
    console.error('Twitter fetch error:', error);
    throw new Error(`Twitter fetch failed: ${error.message}`);
  }
}

// Reddit data fetch activity
export async function fetchRedditData(params: DataFetchParams): Promise<string> {
  const { heartbeat } = Context.current();
  
  try {
    heartbeat({ message: 'Fetching Reddit data...' });
    
    const result = await redditSearchTool.handler({
      query: params.query,
      limit: params.limit || 50,
      smartMatch: params.smartMatch || false,
      website: params.website
    });
    
    heartbeat({ message: 'Reddit data fetched successfully' });
    return result;
  } catch (error: any) {
    console.error('Reddit fetch error:', error);
    throw new Error(`Reddit fetch failed: ${error.message}`);
  }
}

// Bluesky data fetch activity
export async function fetchBlueskyData(params: DataFetchParams): Promise<string> {
  const { heartbeat } = Context.current();
  
  try {
    heartbeat({ message: 'Fetching Bluesky data...' });
    
    const result = await blueskySearchTool.handler({
      query: params.query,
      limit: params.limit || 50
    });
    
    heartbeat({ message: 'Bluesky data fetched successfully' });
    return result;
  } catch (error: any) {
    console.error('Bluesky fetch error:', error);
    throw new Error(`Bluesky fetch failed: ${error.message}`);
  }
}

// YouTube data fetch activity
export async function fetchYouTubeData(params: DataFetchParams): Promise<string> {
  const { heartbeat } = Context.current();
  
  try {
    heartbeat({ message: 'Fetching YouTube data...' });
    
    const result = await youtubeSearchTool.handler({
      query: params.query,
      limit: params.limit || 25
    });
    
    heartbeat({ message: 'YouTube data fetched successfully' });
    return result;
  } catch (error: any) {
    console.error('YouTube fetch error:', error);
    throw new Error(`YouTube fetch failed: ${error.message}`);
  }
}

// TikTok data fetch activity
export async function fetchTikTokData(params: DataFetchParams): Promise<string> {
  const { heartbeat } = Context.current();
  
  try {
    heartbeat({ message: 'Fetching TikTok data...' });
    
    const result = await tiktokSearchTool.handler({
      query: params.query,
      limit: params.limit || 50,
      smartMatch: params.smartMatch || false,
      website: params.website
    });
    
    heartbeat({ message: 'TikTok data fetched successfully' });
    return result;
  } catch (error: any) {
    console.error('TikTok fetch error:', error);
    throw new Error(`TikTok fetch failed: ${error.message}`);
  }
}

// Instagram data fetch activity
export async function fetchInstagramData(params: DataFetchParams): Promise<string> {
  const { heartbeat } = Context.current();
  
  try {
    heartbeat({ message: 'Fetching Instagram data...' });
    
    const result = await instagramSearchTool.handler({
      query: params.query,
      type: 'hashtag',
      limit: params.limit || 50,
      smartMatch: params.smartMatch || false,
      website: params.website
    });
    
    heartbeat({ message: 'Instagram data fetched successfully' });
    return result;
  } catch (error: any) {
    console.error('Instagram fetch error:', error);
    throw new Error(`Instagram fetch failed: ${error.message}`);
  }
}

// Web search activities
export async function fetchWebData(params: DataFetchParams): Promise<string> {
  const { heartbeat } = Context.current();
  
  try {
    heartbeat({ message: 'Fetching web data...' });
    
    const result = await tavilyWebSearchTool.handler({
      query: params.query,
      maxResults: params.maxResults || 20
    });
    
    heartbeat({ message: 'Web data fetched successfully' });
    return result;
  } catch (error: any) {
    console.error('Web fetch error:', error);
    throw new Error(`Web fetch failed: ${error.message}`);
  }
}

export async function fetchLinkedInData(params: DataFetchParams): Promise<string> {
  const { heartbeat } = Context.current();
  
  try {
    heartbeat({ message: 'Fetching LinkedIn data...' });
    
    const result = await tavilyLinkedInSearchTool.handler({
      query: params.query,
      maxResults: params.maxResults || 10
    });
    
    heartbeat({ message: 'LinkedIn data fetched successfully' });
    return result;
  } catch (error: any) {
    console.error('LinkedIn fetch error:', error);
    throw new Error(`LinkedIn fetch failed: ${error.message}`);
  }
}

export async function fetchNewsData(params: DataFetchParams): Promise<string> {
  const { heartbeat } = Context.current();
  
  try {
    heartbeat({ message: 'Fetching news data...' });
    
    const result = await tavilyNewsSearchTool.handler({
      query: params.query,
      maxResults: params.maxResults || 10
    });
    
    heartbeat({ message: 'News data fetched successfully' });
    return result;
  } catch (error: any) {
    console.error('News fetch error:', error);
    throw new Error(`News fetch failed: ${error.message}`);
  }
}

export async function fetchTechData(params: DataFetchParams): Promise<string> {
  const { heartbeat } = Context.current();
  
  try {
    heartbeat({ message: 'Fetching tech community data...' });
    
    const result = await tavilyTechSearchTool.handler({
      query: params.query,
      maxResults: params.maxResults || 15
    });
    
    heartbeat({ message: 'Tech data fetched successfully' });
    return result;
  } catch (error: any) {
    console.error('Tech fetch error:', error);
    throw new Error(`Tech fetch failed: ${error.message}`);
  }
}

// Sentiment analysis activity
export async function analyzeSentiment(params: SentimentAnalysisParams): Promise<string> {
  const { heartbeat } = Context.current();
  
  try {
    heartbeat({ message: 'Analyzing sentiment...' });
    
    const result = await sentimentAnalysisTool.handler({
      startup_name: params.startupName,
      useMinMax: params.useMinMax || false,
      deepAnalysis: params.deepAnalysis || false
    });
    
    heartbeat({ message: 'Sentiment analysis completed' });
    return result;
  } catch (error: any) {
    console.error('Sentiment analysis error:', error);
    throw new Error(`Sentiment analysis failed: ${error.message}`);
  }
}

// Database save activity
export async function saveToDatabase(params: DatabaseSaveParams): Promise<void> {
  const { heartbeat } = Context.current();
  
  try {
    heartbeat({ message: 'Saving to database...' });
    
    await saveToMongoDB(params.collection, params.data);
    
    heartbeat({ message: 'Data saved successfully' });
  } catch (error: any) {
    console.error('Database save error:', error);
    throw new Error(`Database save failed: ${error.message}`);
  }
}

// Generate summary activity
export async function generateSummary(results: any): Promise<string> {
  const { heartbeat } = Context.current();
  
  heartbeat({ message: 'Generating executive summary...' });
  
  const { startupName, website, dataSources, sentimentAnalysis } = results;
  
  let summary = `# Comprehensive Analysis: ${startupName}\n\n`;
  
  if (website) {
    summary += `Website: ${website}\n\n`;
  }
  
  summary += `## Data Collection Summary\n`;
  summary += `Analysis ID: ${results.id}\n`;
  summary += `Analyzed at: ${results.analyzedAt}\n\n`;
  
  // Count successful data sources
  const successfulSources = Object.entries(dataSources)
    .filter(([_, value]) => typeof value === 'string' && !value.startsWith('Error:'))
    .length;
  
  summary += `Successfully collected data from ${successfulSources} sources:\n`;
  
  // Add key findings from each source
  Object.entries(dataSources).forEach(([source, data]) => {
    if (typeof data === 'string' && !data.startsWith('Error:')) {
      const lines = data.split('\n');
      const firstLine = lines[0] || '';
      summary += `- ${source}: ${firstLine}\n`;
    }
  });
  
  summary += `\n## Sentiment Analysis\n`;
  if (sentimentAnalysis && !sentimentAnalysis.startsWith('Error:')) {
    summary += sentimentAnalysis;
  } else {
    summary += 'Sentiment analysis pending or failed.\n';
  }
  
  summary += `\n## Key Insights\n`;
  summary += `1. Social Media Presence: Active on ${Object.keys(dataSources).filter(k => ['twitter', 'bluesky', 'youtube'].includes(k)).length} platforms\n`;
  summary += `2. News Coverage: ${dataSources.news ? 'Found recent news articles' : 'Limited news coverage'}\n`;
  summary += `3. Tech Community: ${dataSources.techCommunity ? 'Discussed in tech forums' : 'Limited tech community presence'}\n`;
  
  summary += `\n## Temporal Workflow Benefits\n`;
  summary += `- This analysis was executed with fault tolerance and automatic retries\n`;
  summary += `- Failed activities were automatically retried with exponential backoff\n`;
  summary += `- The workflow can be monitored and replayed if needed\n`;
  
  heartbeat({ message: 'Summary generated successfully' });
  
  return summary;
}
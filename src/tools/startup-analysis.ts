import { z } from 'zod';
import { Tool } from '../types/index.js';
import { twitterSearchTool } from './twitter.js';
import { blueskySearchTool } from './bluesky.js';
import { youtubeSearchTool } from './youtube.js';
import { redditSearchTool } from './reddit.js';
import { tiktokSearchTool } from './tiktok.js';
import { instagramSearchTool } from './instagram.js';
import { tavilyWebSearchTool, tavilyLinkedInSearchTool, tavilyNewsSearchTool, tavilyTechSearchTool } from './tavily.js';
import { sentimentAnalysisTool } from './sentiment.js';
import { saveToMongoDB } from '../services/mongodb.js';

const StartupAnalysisSchema = z.object({
  startup_name: z.string().describe('Name of the startup to analyze'),
  website: z.string().optional().describe('Company website URL'),
  social_accounts: z.object({
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    bluesky: z.string().optional(),
    youtube: z.string().optional(),
    tiktok: z.string().optional(),
    instagram: z.string().optional(),
  }).optional().describe('Official company social media accounts'),
  founders: z.array(z.object({
    name: z.string(),
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    bluesky: z.string().optional(),
  })).optional().describe('List of founders with their social handles'),
  keywords: z.array(z.string()).optional().describe('Additional keywords to search for'),
  competitors: z.array(z.string()).optional().describe('List of competitor names'),
});

async function analyzeStartup(params: z.infer<typeof StartupAnalysisSchema>): Promise<string> {
  const { startup_name, website, social_accounts, founders, keywords, competitors } = params;
  
  console.error(`Starting comprehensive analysis for: ${startup_name}`);
  
  const analysisId = `analysis_${Date.now()}`;
  const results: Record<string, any> = {
    id: analysisId,
    startup_name,
    website,
    social_accounts,
    founders,
    analyzed_at: new Date(),
    data_sources: {},
  };
  
  // Parallel data collection
  const searchPromises: Promise<void>[] = [];
  
  // Social media searches with smart matching
  searchPromises.push(
    twitterSearchTool.handler({ 
      query: startup_name, 
      limit: 100,
      smartMatch: true,
      website 
    })
      .then(r => { results.data_sources.twitter = r; })
      .catch(e => { results.data_sources.twitter = `Error: ${e.message}`; })
  );
  
  searchPromises.push(
    blueskySearchTool.handler({ query: startup_name, limit: 50 })
      .then(r => { results.data_sources.bluesky = r; })
      .catch(e => { results.data_sources.bluesky = `Error: ${e.message}`; })
  );
  
  searchPromises.push(
    youtubeSearchTool.handler({ query: `${startup_name} demo review`, limit: 25 })
      .then(r => { results.data_sources.youtube = r; })
      .catch(e => { results.data_sources.youtube = `Error: ${e.message}`; })
  );
  
  // Reddit search with smart matching
  searchPromises.push(
    redditSearchTool.handler({ 
      query: startup_name, 
      limit: 50,
      smartMatch: true,
      website 
    })
      .then(r => { results.data_sources.reddit = r; })
      .catch(e => { results.data_sources.reddit = `Error: ${e.message}`; })
  );
  
  // TikTok search with smart matching
  searchPromises.push(
    tiktokSearchTool.handler({ 
      query: startup_name, 
      limit: 50,
      smartMatch: true,
      website 
    })
      .then(r => { results.data_sources.tiktok = r; })
      .catch(e => { results.data_sources.tiktok = `Error: ${e.message}`; })
  );
  
  // Instagram search
  searchPromises.push(
    instagramSearchTool.handler({ 
      query: startup_name, 
      type: 'hashtag',
      limit: 50,
      smartMatch: true,
      website 
    })
      .then(r => { results.data_sources.instagram = r; })
      .catch(e => { results.data_sources.instagram = `Error: ${e.message}`; })
  );
  
  // Web searches
  searchPromises.push(
    tavilyWebSearchTool.handler({ query: startup_name, maxResults: 20 })
      .then(r => { results.data_sources.web_general = r; })
      .catch(e => { results.data_sources.web_general = `Error: ${e.message}`; })
  );
  
  searchPromises.push(
    tavilyLinkedInSearchTool.handler({ query: startup_name })
      .then(r => { results.data_sources.linkedin = r; })
      .catch(e => { results.data_sources.linkedin = `Error: ${e.message}`; })
  );
  
  searchPromises.push(
    tavilyNewsSearchTool.handler({ query: `${startup_name} funding announcement`, maxResults: 10 })
      .then(r => { results.data_sources.news = r; })
      .catch(e => { results.data_sources.news = `Error: ${e.message}`; })
  );
  
  searchPromises.push(
    tavilyTechSearchTool.handler({ query: startup_name, maxResults: 15 })
      .then(r => { results.data_sources.tech_community = r; })
      .catch(e => { results.data_sources.tech_community = `Error: ${e.message}`; })
  );
  
  // Search for founders if provided
  if (founders && founders.length > 0) {
    for (const founder of founders) {
      searchPromises.push(
        tavilyLinkedInSearchTool.handler({ query: `${founder.name} ${startup_name}` })
          .then(r => { 
            if (!results.data_sources.founders) results.data_sources.founders = {};
            results.data_sources.founders[founder.name] = r; 
          })
          .catch(e => { 
            if (!results.data_sources.founders) results.data_sources.founders = {};
            results.data_sources.founders[founder.name] = `Error: ${e.message}`; 
          })
      );
    }
  }
  
  // Search for competitors if provided
  if (competitors && competitors.length > 0) {
    searchPromises.push(
      tavilyWebSearchTool.handler({ 
        query: `${startup_name} vs ${competitors.join(' OR ')} comparison`, 
        maxResults: 15 
      })
        .then(r => { results.data_sources.competitive_analysis = r; })
        .catch(e => { results.data_sources.competitive_analysis = `Error: ${e.message}`; })
    );
  }
  
  // Wait for all searches to complete
  await Promise.all(searchPromises);
  
  // Perform sentiment analysis with deep insights
  try {
    const sentimentResult = await sentimentAnalysisTool.handler({ 
      startup_name, 
      useMinMax: false,
      deepAnalysis: true  // Enable Claude for key posts
    });
    results.sentiment_analysis = sentimentResult;
  } catch (error: any) {
    results.sentiment_analysis = `Error: ${error.message}`;
  }
  
  // Save comprehensive analysis
  await saveToMongoDB('startup_analyses', results);
  
  // Generate executive summary
  const summary = generateExecutiveSummary(results);
  
  console.error(`Generated summary length: ${summary.length}`);
  console.error(`Summary preview: ${summary.substring(0, 200)}...`);
  
  return summary;
}

function generateExecutiveSummary(results: Record<string, any>): string {
  const { startup_name, website, data_sources, sentiment_analysis } = results;
  
  let summary = `# Comprehensive Analysis: ${startup_name}\n\n`;
  
  if (website) {
    summary += `Website: ${website}\n\n`;
  }
  
  summary += `## Data Collection Summary\n`;
  summary += `Analysis ID: ${results.id}\n`;
  summary += `Analyzed at: ${results.analyzed_at}\n\n`;
  
  // Count successful data sources
  const successfulSources = Object.entries(data_sources)
    .filter(([_, value]) => typeof value === 'string' && !value.startsWith('Error:'))
    .length;
  
  summary += `Successfully collected data from ${successfulSources} sources:\n`;
  
  // Add key findings from each source
  Object.entries(data_sources).forEach(([source, data]) => {
    if (typeof data === 'string' && !data.startsWith('Error:')) {
      const lines = data.split('\n');
      const firstLine = lines[0] || '';
      summary += `- ${source}: ${firstLine}\n`;
    }
  });
  
  summary += `\n## Sentiment Analysis\n`;
  if (sentiment_analysis && !sentiment_analysis.startsWith('Error:')) {
    summary += sentiment_analysis;
  } else {
    summary += 'Sentiment analysis pending or failed.\n';
  }
  
  summary += `\n## Key Insights\n`;
  summary += `1. Social Media Presence: Active on ${Object.keys(data_sources).filter(k => ['twitter', 'bluesky', 'youtube', 'tiktok', 'instagram', 'reddit'].includes(k)).length} platforms\n`;
  summary += `2. News Coverage: ${data_sources.news ? 'Found recent news articles' : 'Limited news coverage'}\n`;
  summary += `3. Tech Community: ${data_sources.tech_community ? 'Discussed in tech forums' : 'Limited tech community presence'}\n`;
  summary += `4. Visual Platforms: ${data_sources.tiktok || data_sources.instagram ? 'Active on visual/video platforms' : 'Limited visual content presence'}\n`;
  
  summary += `\n## Recommendations\n`;
  summary += `- Review detailed data in MongoDB for deeper insights\n`;
  summary += `- Monitor sentiment trends over time\n`;
  summary += `- Compare with competitor analysis for market positioning\n`;
  
  return summary;
}

export const startupAnalysisTool: Tool = {
  name: 'analyze_startup',
  description: 'Comprehensive startup analysis across all data sources with sentiment analysis',
  inputSchema: StartupAnalysisSchema,
  handler: analyzeStartup,
};
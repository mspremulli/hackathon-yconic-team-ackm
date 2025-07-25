import { Resource } from '../types/index.js';
import { queryMongoDB } from '../services/mongodb.js';

async function getStartupData(): Promise<string> {
  try {
    // Get recent analyses
    const recentAnalyses = await queryMongoDB(
      'startup_analyses',
      {},
      { sort: { analyzed_at: -1 }, limit: 10 }
    );
    
    // Get sentiment summaries
    const sentimentSummaries = await queryMongoDB(
      'sentiment_analysis',
      {},
      { sort: { analyzed_at: -1 }, limit: 10 }
    );
    
    // Format as JSON
    const data = {
      recent_analyses: recentAnalyses.map(analysis => ({
        startup_name: analysis.startup_name,
        analyzed_at: analysis.analyzed_at,
        data_sources: Object.keys(analysis.data_sources || {}),
        id: analysis.id,
      })),
      sentiment_summaries: sentimentSummaries.map(summary => ({
        startup_name: summary.startup_name,
        overall_sentiment: summary.overall_sentiment,
        confidence: summary.average_confidence,
        texts_analyzed: summary.texts_analyzed,
        analyzed_at: summary.analyzed_at,
      })),
      total_startups_analyzed: new Set([
        ...recentAnalyses.map(a => a.startup_name),
        ...sentimentSummaries.map(s => s.startup_name),
      ]).size,
    };
    
    return JSON.stringify(data, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: 'Failed to retrieve startup data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export const startupDataResource: Resource = {
  uri: 'startup-sentiment://data/recent',
  name: 'Recent Startup Data',
  description: 'Access recent startup analyses and sentiment summaries from MongoDB',
  mimeType: 'application/json',
  handler: getStartupData,
};
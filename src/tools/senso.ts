import { z } from 'zod';
import axios from 'axios';
import { Tool } from '../types/index.js';
import { saveToMongoDB, queryMongoDB } from '../services/mongodb.js';

const SensoSummarySchema = z.object({
  startup_name: z.string().describe('Name of the startup to summarize'),
  analysis_id: z.string().optional().describe('Specific analysis ID to summarize'),
  include_sources: z.array(z.enum(['twitter', 'reddit', 'tiktok', 'instagram', 'youtube', 'bluesky', 'news', 'web']))
    .optional()
    .describe('Specific sources to include in summary'),
  summary_type: z.enum(['executive', 'detailed', 'sentiment', 'competitive'])
    .optional()
    .default('executive')
    .describe('Type of summary to generate'),
});

async function generateSensoSummary(params: z.infer<typeof SensoSummarySchema>): Promise<string> {
  const { startup_name, analysis_id, include_sources, summary_type } = params;
  
  if (!process.env.SENSO_API_KEY) {
    return 'Senso.ai API key not configured. Please set SENSO_API_KEY in .env';
  }
  
  console.error(`Generating Senso.ai summary for: ${startup_name}`);
  
  try {
    // Step 1: Fetch data from MongoDB
    const query: any = { startup_name };
    if (analysis_id) {
      query.id = analysis_id;
    }
    
    // Get the latest analysis
    const analyses = await queryMongoDB('startup_analyses', query, { 
      limit: 1, 
      sort: { analyzed_at: -1 } 
    });
    
    if (analyses.length === 0) {
      return `No analysis found for startup: ${startup_name}`;
    }
    
    const analysis = analyses[0];
    
    // Get social posts for this startup
    const socialPosts = await queryMongoDB('social_posts', 
      { query: startup_name }, 
      { limit: 100, sort: { timestamp: -1 } }
    );
    
    // Step 2: Prepare data for Senso.ai
    const dataToSummarize: any = {
      startup_name,
      analysis_date: analysis.analyzed_at,
      data_sources: {},
      social_metrics: {
        total_posts: socialPosts.length,
        platforms: {},
        engagement_summary: {}
      }
    };
    
    // Filter sources if specified
    const sources = include_sources || Object.keys(analysis.data_sources || {});
    sources.forEach(source => {
      if (analysis.data_sources && analysis.data_sources[source]) {
        dataToSummarize.data_sources[source] = analysis.data_sources[source];
      }
    });
    
    // Aggregate social metrics by platform
    const platformMetrics: Record<string, any> = {};
    socialPosts.forEach((post: any) => {
      const platform = post.platform;
      if (!platformMetrics[platform]) {
        platformMetrics[platform] = {
          count: 0,
          total_likes: 0,
          total_comments: 0,
          total_shares: 0,
          total_views: 0,
          authors: new Set(),
          verified_authors: new Set()
        };
      }
      
      platformMetrics[platform].count++;
      platformMetrics[platform].total_likes += post.engagement?.likes || 0;
      platformMetrics[platform].total_comments += post.engagement?.comments || 0;
      platformMetrics[platform].total_shares += post.engagement?.shares || 0;
      platformMetrics[platform].total_views += post.engagement?.views || 0;
      platformMetrics[platform].authors.add(post.author);
      
      if (post.author_verified) {
        platformMetrics[platform].verified_authors.add(post.author);
      }
    });
    
    // Convert sets to counts
    Object.keys(platformMetrics).forEach(platform => {
      dataToSummarize.social_metrics.platforms[platform] = {
        post_count: platformMetrics[platform].count,
        unique_authors: platformMetrics[platform].authors.size,
        verified_authors: platformMetrics[platform].verified_authors.size,
        total_engagement: {
          likes: platformMetrics[platform].total_likes,
          comments: platformMetrics[platform].total_comments,
          shares: platformMetrics[platform].total_shares,
          views: platformMetrics[platform].total_views
        }
      };
    });
    
    // Add sentiment analysis if available
    if (analysis.sentiment_analysis) {
      dataToSummarize.sentiment_summary = analysis.sentiment_analysis;
    }
    
    // Step 3: Call Senso.ai API
    const sensoPrompt = buildSensoPrompt(dataToSummarize, summary_type);
    
    const sensoResponse = await axios.post(
      'https://api.senso.ai/v1/summarize',
      {
        prompt: sensoPrompt,
        data: JSON.stringify(dataToSummarize),
        model: 'senso-1', // Using their basic model
        temperature: 0.3,
        max_tokens: 2000,
        format: 'structured'
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.SENSO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    
    const sensoSummary = sensoResponse.data;
    
    // Step 4: Save to MongoDB
    const summaryRecord = {
      startup_name,
      analysis_id: analysis.id,
      summary_type,
      sources_included: sources,
      senso_response: sensoSummary,
      generated_at: new Date(),
      data_statistics: {
        total_posts_analyzed: socialPosts.length,
        platforms_covered: Object.keys(platformMetrics),
        data_sources: sources.length
      },
      summary_text: sensoSummary.summary || sensoSummary.text || 'Summary generation failed',
      key_insights: sensoSummary.insights || [],
      recommendations: sensoSummary.recommendations || [],
      metrics: sensoSummary.metrics || dataToSummarize.social_metrics
    };
    
    await saveToMongoDB('senso_summaries', summaryRecord);
    
    // Step 5: Format response
    let response = `# Senso.ai Summary: ${startup_name}\n\n`;
    response += `Summary Type: ${summary_type}\n`;
    response += `Generated: ${new Date().toISOString()}\n\n`;
    
    response += `## Executive Summary\n`;
    response += summaryRecord.summary_text + '\n\n';
    
    if (summaryRecord.key_insights.length > 0) {
      response += `## Key Insights\n`;
      summaryRecord.key_insights.forEach((insight: string, idx: number) => {
        response += `${idx + 1}. ${insight}\n`;
      });
      response += '\n';
    }
    
    if (summaryRecord.recommendations.length > 0) {
      response += `## Recommendations\n`;
      summaryRecord.recommendations.forEach((rec: string, idx: number) => {
        response += `${idx + 1}. ${rec}\n`;
      });
      response += '\n';
    }
    
    response += `## Data Coverage\n`;
    response += `- Total Posts Analyzed: ${summaryRecord.data_statistics.total_posts_analyzed}\n`;
    response += `- Platforms: ${summaryRecord.data_statistics.platforms_covered.join(', ')}\n`;
    response += `- Data Sources: ${summaryRecord.data_statistics.data_sources}\n\n`;
    
    response += `✅ Summary saved to MongoDB collection: senso_summaries`;
    
    return response;
    
  } catch (error: any) {
    console.error('Senso.ai summary generation error:', error);
    
    // Fallback to basic summary
    if (error.response?.status === 401) {
      return 'Senso.ai authentication failed. Please check your API key.';
    } else if (error.response?.status === 429) {
      return 'Senso.ai rate limit exceeded. Please try again later.';
    }
    
    // If Senso fails, create a basic summary
    return await createFallbackSummary(startup_name, params);
  }
}

function buildSensoPrompt(data: any, summaryType: string): string {
  const prompts: Record<string, string> = {
    executive: `Create an executive summary of this startup data focusing on:
1. Overall market presence and traction
2. Social media engagement and reach
3. Key strengths and opportunities
4. Recommended next steps for growth`,
    
    detailed: `Provide a comprehensive analysis of this startup including:
1. Platform-by-platform breakdown
2. Engagement metrics and trends
3. Content themes and messaging
4. Audience demographics and behavior
5. Competitive positioning`,
    
    sentiment: `Analyze the sentiment and perception of this startup:
1. Overall sentiment score and distribution
2. Key positive and negative themes
3. Influencer and verified account opinions
4. Reputation risks and opportunities`,
    
    competitive: `Provide a competitive analysis based on the data:
1. Market positioning
2. Unique value propositions mentioned
3. Comparison with industry standards
4. Growth potential and market opportunities`
  };
  
  return prompts[summaryType] || prompts.executive;
}

async function createFallbackSummary(startupName: string, params: any): Promise<string> {
  // Basic summary without Senso.ai
  try {
    const analyses = await queryMongoDB('startup_analyses', 
      { startup_name: startupName }, 
      { limit: 1, sort: { analyzed_at: -1 } }
    );
    
    if (analyses.length === 0) {
      return `No analysis found for startup: ${startupName}`;
    }
    
    const analysis = analyses[0];
    const socialPosts = await queryMongoDB('social_posts', 
      { query: startupName }, 
      { limit: 100 }
    );
    
    let summary = `# Basic Summary: ${startupName}\n\n`;
    summary += `⚠️ Note: Senso.ai unavailable, using fallback summary\n\n`;
    
    summary += `## Overview\n`;
    summary += `- Analysis Date: ${analysis.analyzed_at}\n`;
    summary += `- Total Posts: ${socialPosts.length}\n`;
    summary += `- Data Sources: ${Object.keys(analysis.data_sources || {}).length}\n\n`;
    
    // Platform breakdown
    const platforms = socialPosts.reduce((acc: any, post: any) => {
      acc[post.platform] = (acc[post.platform] || 0) + 1;
      return acc;
    }, {});
    
    summary += `## Platform Distribution\n`;
    Object.entries(platforms).forEach(([platform, count]) => {
      summary += `- ${platform}: ${count} posts\n`;
    });
    
    // Save fallback summary
    const fallbackRecord = {
      startup_name: startupName,
      analysis_id: analysis.id,
      summary_type: 'fallback',
      generated_at: new Date(),
      summary_text: summary,
      is_fallback: true
    };
    
    await saveToMongoDB('senso_summaries', fallbackRecord);
    
    return summary + '\n\n✅ Fallback summary saved to MongoDB';
    
  } catch (error) {
    return `Error creating summary: ${error}`;
  }
}

export const sensoSummaryTool: Tool = {
  name: 'senso_summary',
  description: 'Generate AI-powered summary of startup data using Senso.ai and save to MongoDB',
  inputSchema: SensoSummarySchema,
  handler: generateSensoSummary,
};

// Tool to retrieve Senso summaries
const GetSensoSummarySchema = z.object({
  startup_name: z.string().describe('Startup name to retrieve summaries for'),
  limit: z.number().optional().default(5).describe('Number of summaries to retrieve'),
});

async function getSensoSummaries(params: z.infer<typeof GetSensoSummarySchema>): Promise<string> {
  const { startup_name, limit } = params;
  
  try {
    const summaries = await queryMongoDB('senso_summaries', 
      { startup_name }, 
      { limit, sort: { generated_at: -1 } }
    );
    
    if (summaries.length === 0) {
      return `No Senso.ai summaries found for: ${startup_name}`;
    }
    
    let response = `# Senso.ai Summaries for ${startup_name}\n\n`;
    response += `Found ${summaries.length} summaries\n\n`;
    
    summaries.forEach((summary: any, idx: number) => {
      response += `## Summary ${idx + 1}\n`;
      response += `- Type: ${summary.summary_type}\n`;
      response += `- Generated: ${summary.generated_at}\n`;
      response += `- Sources: ${summary.sources_included?.join(', ') || 'all'}\n`;
      response += `- Posts Analyzed: ${summary.data_statistics?.total_posts_analyzed || 'N/A'}\n\n`;
      
      response += `### Summary\n`;
      response += summary.summary_text + '\n\n';
      
      if (summary.key_insights?.length > 0) {
        response += `### Insights\n`;
        summary.key_insights.forEach((insight: string) => {
          response += `- ${insight}\n`;
        });
        response += '\n';
      }
    });
    
    return response;
  } catch (error: any) {
    return `Error retrieving summaries: ${error.message}`;
  }
}

export const getSensoSummaryTool: Tool = {
  name: 'get_senso_summaries',
  description: 'Retrieve previously generated Senso.ai summaries from MongoDB',
  inputSchema: GetSensoSummarySchema,
  handler: getSensoSummaries,
};
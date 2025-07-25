import { z } from 'zod';
import { Tool } from '../types/index.js';
import { aggregateMongoDB, queryMongoDB } from '../services/mongodb.js';

const DashboardSchema = z.object({
  startup_name: z.string().optional().describe('Filter by specific startup'),
  time_range: z.enum(['24h', '7d', '30d', 'all']).optional().default('7d'),
  include_competitors: z.boolean().optional().default(false),
});

async function generateDashboard(params: z.infer<typeof DashboardSchema>): Promise<string> {
  const { startup_name, time_range, include_competitors } = params;
  
  // Calculate date filter
  const dateFilter = getDateFilter(time_range);
  
  // Build query
  const query: any = {};
  if (startup_name) {
    query.$or = [
      { startup_name },
      { query: startup_name },
      { 'params.startup_name': startup_name },
    ];
  }
  if (dateFilter) {
    query.timestamp = { $gte: dateFilter };
  }
  
  // Aggregate data from different collections
  const [
    socialPosts,
    sentimentAnalyses,
    webSearchResults,
    youtubeVideos,
    startupAnalyses,
  ] = await Promise.all([
    queryMongoDB('social_posts', query),
    queryMongoDB('sentiment_analysis', startup_name ? { startup_name } : {}),
    queryMongoDB('web_search_results', query),
    queryMongoDB('youtube_videos', query),
    queryMongoDB('startup_analyses', startup_name ? { startup_name } : {}),
  ]);
  
  // Generate dashboard sections
  let dashboard = `# Startup Sentiment Dashboard\n`;
  dashboard += `Time Range: ${time_range}\n`;
  if (startup_name) {
    dashboard += `Startup: ${startup_name}\n`;
  }
  dashboard += `Generated: ${new Date().toISOString()}\n\n`;
  
  // Social Media Overview
  dashboard += `## Social Media Activity\n`;
  const platformCounts = countByPlatform(socialPosts);
  dashboard += `Total Posts: ${socialPosts.length}\n`;
  Object.entries(platformCounts).forEach(([platform, count]) => {
    dashboard += `- ${platform}: ${count} posts\n`;
  });
  dashboard += '\n';
  
  // Engagement Metrics
  const totalEngagement = calculateTotalEngagement(socialPosts);
  dashboard += `## Engagement Metrics\n`;
  dashboard += `Total Engagement: ${totalEngagement.total.toLocaleString()}\n`;
  dashboard += `- Likes: ${totalEngagement.likes.toLocaleString()}\n`;
  dashboard += `- Shares: ${totalEngagement.shares.toLocaleString()}\n`;
  dashboard += `- Comments: ${totalEngagement.comments.toLocaleString()}\n\n`;
  
  // Sentiment Summary
  if (sentimentAnalyses.length > 0) {
    dashboard += `## Sentiment Analysis\n`;
    const latestSentiment = sentimentAnalyses[sentimentAnalyses.length - 1];
    if (latestSentiment.overall_sentiment) {
      dashboard += `Overall Sentiment: ${latestSentiment.overall_sentiment.toUpperCase()}\n`;
      dashboard += `Confidence: ${(latestSentiment.average_confidence * 100).toFixed(1)}%\n`;
      
      if (latestSentiment.sentiment_distribution) {
        dashboard += `\nDistribution:\n`;
        Object.entries(latestSentiment.sentiment_distribution).forEach(([sentiment, count]) => {
          dashboard += `- ${sentiment}: ${count}\n`;
        });
      }
      
      if (latestSentiment.top_aspects && latestSentiment.top_aspects.length > 0) {
        dashboard += `\nTop Aspects:\n`;
        latestSentiment.top_aspects.forEach((aspect: any) => {
          dashboard += `- ${aspect.aspect}: ${aspect.sentiment}\n`;
        });
      }
    }
    dashboard += '\n';
  }
  
  // YouTube Presence
  if (youtubeVideos.length > 0) {
    dashboard += `## YouTube Presence\n`;
    dashboard += `Videos Found: ${youtubeVideos.length}\n`;
    const totalViews = youtubeVideos.reduce((sum, v) => sum + (v.engagement?.views || 0), 0);
    dashboard += `Total Views: ${totalViews.toLocaleString()}\n`;
    
    // Top videos
    const topVideos = youtubeVideos
      .sort((a, b) => (b.engagement?.views || 0) - (a.engagement?.views || 0))
      .slice(0, 3);
    
    if (topVideos.length > 0) {
      dashboard += `\nTop Videos:\n`;
      topVideos.forEach(video => {
        dashboard += `- "${video.title}" - ${video.engagement?.views?.toLocaleString() || 0} views\n`;
      });
    }
    dashboard += '\n';
  }
  
  // Web Presence
  if (webSearchResults.length > 0) {
    dashboard += `## Web Presence\n`;
    dashboard += `Web Mentions: ${webSearchResults.length}\n`;
    
    // Domain distribution
    const domains = webSearchResults.reduce((acc: Record<string, number>, result) => {
      const domain = result.domain || 'unknown';
      acc[domain] = (acc[domain] || 0) + 1;
      return acc;
    }, {});
    
    dashboard += `\nTop Domains:\n`;
    Object.entries(domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([domain, count]) => {
        dashboard += `- ${domain}: ${count} mentions\n`;
      });
    dashboard += '\n';
  }
  
  // Recent Activity
  dashboard += `## Recent Activity\n`;
  const recentPosts = [...socialPosts, ...webSearchResults]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);
  
  if (recentPosts.length > 0) {
    recentPosts.forEach(post => {
      const date = new Date(post.timestamp).toLocaleDateString();
      const platform = post.platform || 'web';
      const content = post.content?.substring(0, 100) || post.title || 'No content';
      dashboard += `- [${date}] ${platform}: ${content}...\n`;
    });
  } else {
    dashboard += 'No recent activity found.\n';
  }
  
  // Recommendations
  dashboard += `\n## Insights & Recommendations\n`;
  dashboard += generateInsights(socialPosts, sentimentAnalyses, webSearchResults);
  
  return dashboard;
}

function getDateFilter(timeRange: string): Date | null {
  const now = new Date();
  switch (timeRange) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default:
      return null;
  }
}

function countByPlatform(posts: any[]): Record<string, number> {
  return posts.reduce((acc, post) => {
    const platform = post.platform || 'unknown';
    acc[platform] = (acc[platform] || 0) + 1;
    return acc;
  }, {});
}

function calculateTotalEngagement(posts: any[]): any {
  return posts.reduce((acc, post) => {
    if (post.engagement) {
      acc.likes += post.engagement.likes || 0;
      acc.shares += post.engagement.shares || 0;
      acc.comments += post.engagement.comments || 0;
      acc.total += (post.engagement.likes || 0) + (post.engagement.shares || 0) + (post.engagement.comments || 0);
    }
    return acc;
  }, { likes: 0, shares: 0, comments: 0, total: 0 });
}

function generateInsights(socialPosts: any[], sentimentAnalyses: any[], webSearchResults: any[]): string {
  const insights: string[] = [];
  
  // Engagement insight
  const avgEngagement = socialPosts.length > 0 
    ? calculateTotalEngagement(socialPosts).total / socialPosts.length 
    : 0;
  
  if (avgEngagement > 100) {
    insights.push('• High social media engagement indicates strong market interest');
  } else if (avgEngagement < 10 && socialPosts.length > 10) {
    insights.push('• Low engagement suggests need for improved social media strategy');
  }
  
  // Sentiment insight
  if (sentimentAnalyses.length > 0) {
    const latestSentiment = sentimentAnalyses[sentimentAnalyses.length - 1];
    if (latestSentiment.overall_sentiment === 'positive') {
      insights.push('• Positive sentiment indicates favorable market perception');
    } else if (latestSentiment.overall_sentiment === 'negative') {
      insights.push('• Negative sentiment requires immediate attention and response strategy');
    }
  }
  
  // Growth insight
  if (socialPosts.length > 50) {
    insights.push('• High volume of mentions suggests growing brand awareness');
  }
  
  // Platform diversity
  const platforms = new Set(socialPosts.map(p => p.platform));
  if (platforms.size >= 3) {
    insights.push('• Good multi-platform presence enhances reach');
  } else {
    insights.push('• Consider expanding to more social media platforms');
  }
  
  return insights.join('\n') || '• Continue monitoring for trend analysis';
}

export const dashboardSummaryTool: Tool = {
  name: 'dashboard_summary',
  description: 'Generate a comprehensive dashboard summary of startup sentiment and metrics',
  inputSchema: DashboardSchema,
  handler: generateDashboard,
};
import { z } from 'zod';
import axios from 'axios';
import { Tool } from '../types/index.js';
import { saveToMongoDB } from '../services/mongodb.js';
import { generateNameVariations, buildSmartQueries } from '../services/smart-matching.js';

const TikTokSearchSchema = z.object({
  query: z.string().describe('Search query for TikTok'),
  limit: z.number().optional().default(50).describe('Number of posts to fetch'),
  smartMatch: z.boolean().optional().default(false).describe('Use smart matching for startup names'),
  website: z.string().optional().describe('Company website for smart matching'),
});

async function searchTikTok(params: z.infer<typeof TikTokSearchSchema>): Promise<string> {
  const { query, limit, smartMatch, website } = params;
  
  if (!process.env.BRIGHT_DATA_API_KEY || !process.env.BRIGHT_DATA_CUSTOMER_ID) {
    return 'Bright Data credentials not configured for TikTok scraping.';
  }
  
  console.error('Using Bright Data for TikTok scraping...');
  
  try {
    let searchQuery = query;
    
    // Apply smart matching if requested
    if (smartMatch) {
      const variations = generateNameVariations(query, website);
      const smartQueries = buildSmartQueries(variations);
      searchQuery = smartQueries.tiktok || query;
      console.error(`Smart TikTok query: ${searchQuery}`);
    }
    
    // Bright Data TikTok search endpoint
    const response = await axios.post(
      'https://api.brightdata.com/dca/dataset/tiktok_search',
      {
        query: searchQuery,
        limit,
        customer_id: process.env.BRIGHT_DATA_CUSTOMER_ID,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.BRIGHT_DATA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    
    const posts = response.data.data || [];
    
    // Process and save posts
    const processedPosts = posts.map((post: any) => ({
      id: post.id,
      platform: 'tiktok',
      author: post.author?.username || 'Unknown',
      author_handle: post.author?.handle || '',
      content: post.description || '',
      timestamp: new Date(post.created_at || Date.now()),
      engagement: {
        likes: post.stats?.likes || 0,
        shares: post.stats?.shares || 0,
        comments: post.stats?.comments || 0,
        views: post.stats?.views || 0,
      },
      url: post.video_url || `https://www.tiktok.com/@${post.author?.handle}/video/${post.id}`,
      hashtags: post.hashtags || [],
      music: post.music?.title || null,
      duration: post.video_duration || 0,
      query: searchQuery,
      collected_at: new Date(),
    }));
    
    // Save to MongoDB
    if (processedPosts.length > 0) {
      await saveToMongoDB('social_posts', processedPosts);
    }
    
    // Generate summary
    let summary = `Found ${processedPosts.length} TikTok posts for "${searchQuery}"\n\n`;
    
    if (processedPosts.length > 0) {
      // Calculate engagement metrics
      const totalViews = processedPosts.reduce((sum: number, p: any) => sum + (p.engagement.views || 0), 0);
      const totalLikes = processedPosts.reduce((sum: number, p: any) => sum + (p.engagement.likes || 0), 0);
      const avgEngagement = processedPosts.reduce((sum: number, p: any) => {
        const total = p.engagement.likes + p.engagement.comments + p.engagement.shares;
        const views = p.engagement.views || 1;
        return sum + (total / views * 100);
      }, 0) / processedPosts.length;
      
      summary += `📊 Engagement Metrics:\n`;
      summary += `- Total Views: ${totalViews.toLocaleString()}\n`;
      summary += `- Total Likes: ${totalLikes.toLocaleString()}\n`;
      summary += `- Avg Engagement Rate: ${avgEngagement.toFixed(2)}%\n\n`;
      
      // Top posts
      const topPosts = processedPosts
        .sort((a: any, b: any) => b.engagement.views - a.engagement.views)
        .slice(0, 5);
      
      summary += `🎯 Top Posts:\n`;
      topPosts.forEach((post: any, idx: number) => {
        summary += `${idx + 1}. @${post.author} - ${post.engagement.views.toLocaleString()} views\n`;
        summary += `   "${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : ''}"\n`;
        summary += `   💖 ${post.engagement.likes.toLocaleString()} | 💬 ${post.engagement.comments.toLocaleString()} | 🔄 ${post.engagement.shares.toLocaleString()}\n\n`;
      });
      
      // Popular hashtags
      const hashtagCounts = new Map<string, number>();
      processedPosts.forEach((post: any) => {
        (post.hashtags || []).forEach((tag: string) => {
          hashtagCounts.set(tag, (hashtagCounts.get(tag) || 0) + 1);
        });
      });
      
      const topHashtags = Array.from(hashtagCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      if (topHashtags.length > 0) {
        summary += `🏷️ Trending Hashtags:\n`;
        topHashtags.forEach(([tag, count]) => {
          summary += `- #${tag} (${count} posts)\n`;
        });
      }
    }
    
    return summary;
  } catch (error: any) {
    console.error('TikTok search error:', error);
    
    // Fallback message
    return `TikTok search via Bright Data failed: ${error.message}\n\nNote: TikTok scraping requires valid Bright Data credentials with TikTok dataset access.`;
  }
}

export const tiktokSearchTool: Tool = {
  name: 'tiktok_search',
  description: 'Search TikTok for posts about startups using Bright Data',
  inputSchema: TikTokSearchSchema,
  handler: searchTikTok,
};
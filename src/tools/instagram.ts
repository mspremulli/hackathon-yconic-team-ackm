import { z } from 'zod';
import axios from 'axios';
import { Tool } from '../types/index.js';
import { saveToMongoDB } from '../services/mongodb.js';
import { generateNameVariations, buildSmartQueries } from '../services/smart-matching.js';

const InstagramSearchSchema = z.object({
  query: z.string().describe('Search query or hashtag for Instagram'),
  type: z.enum(['hashtag', 'user', 'location']).optional().default('hashtag').describe('Type of search'),
  limit: z.number().optional().default(50).describe('Number of posts to fetch'),
  smartMatch: z.boolean().optional().default(false).describe('Use smart matching for startup names'),
  website: z.string().optional().describe('Company website for smart matching'),
});

async function searchInstagram(params: z.infer<typeof InstagramSearchSchema>): Promise<string> {
  const { query, type, limit, smartMatch, website } = params;
  
  if (!process.env.BRIGHT_DATA_API_KEY || !process.env.BRIGHT_DATA_CUSTOMER_ID) {
    return 'Bright Data credentials not configured for Instagram scraping.';
  }
  
  console.error('Using Bright Data for Instagram scraping...');
  
  try {
    let searchQuery = query;
    
    // Apply smart matching if requested
    if (smartMatch) {
      const variations = generateNameVariations(query, website);
      const smartQueries = buildSmartQueries(variations);
      searchQuery = smartQueries.instagram || query;
      console.error(`Smart Instagram query: ${searchQuery}`);
    }
    
    // Format query based on type
    const formattedQuery = type === 'hashtag' && !searchQuery.startsWith('#') 
      ? `#${searchQuery.replace(/\s+/g, '')}`
      : searchQuery;
    
    // Bright Data Instagram endpoint
    const endpoint = type === 'user' 
      ? 'https://api.brightdata.com/dca/dataset/instagram_profile'
      : 'https://api.brightdata.com/dca/dataset/instagram_hashtag';
    
    const response = await axios.post(
      endpoint,
      {
        query: formattedQuery,
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
      id: post.id || post.shortcode,
      platform: 'instagram',
      author: post.owner?.username || 'Unknown',
      author_handle: post.owner?.username || '',
      author_verified: post.owner?.is_verified || false,
      content: post.caption || '',
      timestamp: new Date(post.taken_at_timestamp * 1000 || Date.now()),
      engagement: {
        likes: post.like_count || 0,
        comments: post.comment_count || 0,
        views: post.video_view_count || null,
      },
      url: post.display_url || `https://www.instagram.com/p/${post.shortcode}/`,
      media_type: post.is_video ? 'video' : 'photo',
      hashtags: extractHashtags(post.caption || ''),
      location: post.location?.name || null,
      query: searchQuery,
      collected_at: new Date(),
    }));
    
    // Save to MongoDB
    if (processedPosts.length > 0) {
      await saveToMongoDB('social_posts', processedPosts);
    }
    
    // Generate summary
    let summary = `Found ${processedPosts.length} Instagram posts for "${searchQuery}" (${type} search)\n\n`;
    
    if (processedPosts.length > 0) {
      // Calculate engagement metrics
      const totalLikes = processedPosts.reduce((sum: number, p: any) => sum + p.engagement.likes, 0);
      const totalComments = processedPosts.reduce((sum: number, p: any) => sum + p.engagement.comments, 0);
      const avgEngagement = processedPosts.reduce((sum: number, p: any) => {
        return sum + p.engagement.likes + p.engagement.comments;
      }, 0) / processedPosts.length;
      
      summary += `📊 Engagement Metrics:\n`;
      summary += `- Total Likes: ${totalLikes.toLocaleString()}\n`;
      summary += `- Total Comments: ${totalComments.toLocaleString()}\n`;
      summary += `- Avg Engagement: ${Math.round(avgEngagement).toLocaleString()}\n\n`;
      
      // Top posts
      const topPosts = processedPosts
        .sort((a: any, b: any) => (b.engagement.likes + b.engagement.comments) - (a.engagement.likes + a.engagement.comments))
        .slice(0, 5);
      
      summary += `🎯 Top Posts:\n`;
      topPosts.forEach((post: any, idx: number) => {
        summary += `${idx + 1}. @${post.author}${post.author_verified ? ' ✓' : ''}\n`;
        summary += `   "${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : ''}"\n`;
        summary += `   ❤️ ${post.engagement.likes.toLocaleString()} | 💬 ${post.engagement.comments.toLocaleString()}`;
        if (post.engagement.views) {
          summary += ` | 👁️ ${post.engagement.views.toLocaleString()}`;
        }
        summary += `\n   Type: ${post.media_type}\n\n`;
      });
      
      // Verified accounts
      const verifiedAccounts = processedPosts
        .filter((p: any) => p.author_verified)
        .map((p: any) => p.author)
        .filter((value: string, index: number, self: string[]) => self.indexOf(value) === index);
      
      if (verifiedAccounts.length > 0) {
        summary += `✅ Verified Accounts Mentioning:\n`;
        verifiedAccounts.forEach((account: string) => {
          summary += `- @${account}\n`;
        });
        summary += '\n';
      }
      
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
        summary += `🏷️ Related Hashtags:\n`;
        topHashtags.forEach(([tag, count]) => {
          summary += `- #${tag} (${count} posts)\n`;
        });
      }
      
      // Locations mentioned
      const locations = processedPosts
        .map((p: any) => p.location)
        .filter((loc: string | null) => loc !== null)
        .filter((value: string, index: number, self: string[]) => self.indexOf(value) === index)
        .slice(0, 5);
      
      if (locations.length > 0) {
        summary += `\n📍 Locations:\n`;
        locations.forEach((loc: string) => {
          summary += `- ${loc}\n`;
        });
      }
    }
    
    return summary;
  } catch (error: any) {
    console.error('Instagram search error:', error);
    
    // Fallback message
    return `Instagram search via Bright Data failed: ${error.message}\n\nNote: Instagram scraping requires valid Bright Data credentials with Instagram dataset access.`;
  }
}

function extractHashtags(text: string): string[] {
  const hashtagRegex = /#[a-zA-Z0-9_]+/g;
  const matches = text.match(hashtagRegex) || [];
  return matches.map(tag => tag.substring(1));
}

export const instagramSearchTool: Tool = {
  name: 'instagram_search',
  description: 'Search Instagram for posts and profiles about startups using Bright Data',
  inputSchema: InstagramSearchSchema,
  handler: searchInstagram,
};
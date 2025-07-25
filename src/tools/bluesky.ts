import { z } from 'zod';
import axios from 'axios';
import { Tool } from '../types/index.js';
import { saveToMongoDB } from '../services/mongodb.js';

const BlueskySearchSchema = z.object({
  query: z.string().describe('Search query for Bluesky'),
  limit: z.number().optional().default(50).describe('Maximum number of results'),
  since: z.string().optional().describe('ISO 8601 date string for start time'),
  until: z.string().optional().describe('ISO 8601 date string for end time'),
});

// Bluesky AT Protocol client
class BlueskyClient {
  private accessJwt?: string;
  private did?: string;
  
  async authenticate() {
    if (!process.env.BLUESKY_HANDLE || !process.env.BLUESKY_APP_PASSWORD) {
      throw new Error('Bluesky credentials not configured');
    }
    
    const response = await axios.post('https://bsky.social/xrpc/com.atproto.server.createSession', {
      identifier: process.env.BLUESKY_HANDLE,
      password: process.env.BLUESKY_APP_PASSWORD,
    });
    
    this.accessJwt = response.data.accessJwt;
    this.did = response.data.did;
  }
  
  async search(query: string, limit: number = 50) {
    if (!this.accessJwt) {
      await this.authenticate();
    }
    
    // Search posts
    const response = await axios.get('https://bsky.social/xrpc/app.bsky.feed.searchPosts', {
      headers: {
        'Authorization': `Bearer ${this.accessJwt}`,
      },
      params: {
        q: query,
        limit,
      },
    });
    
    return response.data.posts || [];
  }
}

async function searchBluesky(params: z.infer<typeof BlueskySearchSchema>): Promise<string> {
  const { query, limit, since, until } = params;
  
  if (!process.env.BLUESKY_HANDLE || !process.env.BLUESKY_APP_PASSWORD) {
    return 'Bluesky API credentials not configured. Please set BLUESKY_HANDLE and BLUESKY_APP_PASSWORD in .env';
  }
  
  try {
    const client = new BlueskyClient();
    const posts = await client.search(query, limit);
    
    // Process posts
    const results = posts.map((post: any) => {
      const record = post.record;
      return {
        id: post.uri,
        platform: 'bluesky',
        author: post.author.handle,
        author_name: post.author.displayName || post.author.handle,
        content: record.text,
        timestamp: new Date(record.createdAt),
        engagement: {
          likes: post.likeCount || 0,
          shares: post.repostCount || 0,
          comments: post.replyCount || 0,
        },
        url: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`,
        query,
      };
    });
    
    // Filter by date if specified
    const filteredResults = results.filter((post: any) => {
      if (since && post.timestamp < new Date(since)) return false;
      if (until && post.timestamp > new Date(until)) return false;
      return true;
    });
    
    // Save to MongoDB
    if (filteredResults.length > 0) {
      await saveToMongoDB('social_posts', filteredResults);
    }
    
    // Generate summary
    const totalEngagement = filteredResults.reduce((sum: number, post: any) => 
      sum + post.engagement.likes + post.engagement.shares + post.engagement.comments, 0
    );
    
    const summary = `Found ${filteredResults.length} Bluesky posts for "${query}"
Total engagement: ${totalEngagement.toLocaleString()}
Top posts:
${filteredResults.slice(0, 5).map((p: any) => 
  `- @${p.author}: "${p.content.substring(0, 100)}..." (${p.engagement.likes} likes)`
).join('\n')}`;
    
    return summary;
  } catch (error: any) {
    return `Bluesky search failed: ${error.message}`;
  }
}

export const blueskySearchTool: Tool = {
  name: 'bluesky_search',
  description: 'Search Bluesky for posts from tech-savvy early adopters and developers',
  inputSchema: BlueskySearchSchema,
  handler: searchBluesky,
};
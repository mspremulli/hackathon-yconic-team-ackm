import { z } from 'zod';
import axios from 'axios';
import { Tool } from '../types/index.js';
import { saveToMongoDB } from '../services/mongodb.js';

const YouTubeSearchSchema = z.object({
  query: z.string().describe('Search query for YouTube'),
  limit: z.number().optional().default(25).describe('Maximum number of results'),
  type: z.enum(['video', 'channel', 'playlist']).optional().default('video'),
  order: z.enum(['relevance', 'date', 'viewCount', 'rating']).optional().default('relevance'),
  publishedAfter: z.string().optional().describe('ISO 8601 date string'),
});

async function searchYouTube(params: z.infer<typeof YouTubeSearchSchema>): Promise<string> {
  const { query, limit, type, order, publishedAfter } = params;
  
  if (!process.env.YOUTUBE_API_KEY) {
    return 'YouTube API key not configured. Please set YOUTUBE_API_KEY in .env';
  }
  
  try {
    // Search YouTube
    const searchResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        type,
        order,
        maxResults: Math.min(limit, 50),
        publishedAfter,
        key: process.env.YOUTUBE_API_KEY,
      },
    });
    
    const items = searchResponse.data.items || [];
    
    if (items.length === 0) {
      return `No YouTube ${type}s found for "${query}"`;
    }
    
    // Get video statistics if searching for videos
    if (type === 'video') {
      const videoIds = items.map((item: any) => item.id.videoId).join(',');
      
      const statsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: {
          part: 'statistics,contentDetails',
          id: videoIds,
          key: process.env.YOUTUBE_API_KEY,
        },
      });
      
      const videoStats = new Map(
        statsResponse.data.items.map((item: any) => [item.id, item])
      );
      
      // Process videos with statistics
      const results = items.map((item: any) => {
        const stats = videoStats.get(item.id.videoId) as any;
        return {
          id: item.id.videoId,
          platform: 'youtube',
          author: item.snippet.channelTitle,
          title: item.snippet.title,
          content: item.snippet.description,
          timestamp: new Date(item.snippet.publishedAt),
          engagement: {
            views: parseInt(stats?.statistics?.viewCount || '0'),
            likes: parseInt(stats?.statistics?.likeCount || '0'),
            comments: parseInt(stats?.statistics?.commentCount || '0'),
          },
          duration: stats?.contentDetails?.duration,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          thumbnail: item.snippet.thumbnails.high.url,
          query,
        };
      });
      
      // Save to MongoDB
      await saveToMongoDB('youtube_videos', results);
      
      // Generate summary
      const totalViews = results.reduce((sum: number, video: any) => sum + video.engagement.views, 0);
      const avgViews = Math.round(totalViews / results.length);
      
      const summary = `Found ${results.length} YouTube videos for "${query}"
Total views: ${totalViews.toLocaleString()}
Average views: ${avgViews.toLocaleString()}
Top videos:
${results.slice(0, 5).map((v: any) => 
  `- "${v.title}" by ${v.author} (${v.engagement.views.toLocaleString()} views, ${v.engagement.likes.toLocaleString()} likes)`
).join('\n')}`;
      
      return summary;
    } else {
      // Process channels or playlists
      const results = items.map((item: any) => ({
        id: item.id.channelId || item.id.playlistId,
        type,
        title: item.snippet.title,
        description: item.snippet.description,
        url: type === 'channel' 
          ? `https://www.youtube.com/channel/${item.id.channelId}`
          : `https://www.youtube.com/playlist?list=${item.id.playlistId}`,
        thumbnail: item.snippet.thumbnails.high.url,
        publishedAt: item.snippet.publishedAt,
      }));
      
      const summary = `Found ${results.length} YouTube ${type}s for "${query}"
${results.slice(0, 5).map((r: any) => 
  `- ${r.title}: ${r.description.substring(0, 100)}...`
).join('\n')}`;
      
      return summary;
    }
  } catch (error: any) {
    if (error.response?.status === 403) {
      return 'YouTube API quota exceeded. Please try again later.';
    }
    return `YouTube search failed: ${error.message}`;
  }
}

export const youtubeSearchTool: Tool = {
  name: 'youtube_search',
  description: 'Search YouTube for videos, product demos, reviews, and founder talks',
  inputSchema: YouTubeSearchSchema,
  handler: searchYouTube,
};
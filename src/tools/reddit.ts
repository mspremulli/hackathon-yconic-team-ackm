import { z } from 'zod';
import { Tool } from '../types/index.js';
import { brightDataSearchTool } from './brightdata.js';
import { saveToMongoDB } from '../services/mongodb.js';
import { generateNameVariations, buildSmartQueries, scoreMatch } from '../services/smart-matching.js';

const RedditSearchSchema = z.object({
  query: z.string().describe('Search query for Reddit'),
  subreddits: z.array(z.string()).optional().default([
    'startup', 'technology', 'programming', 'entrepreneur', 
    'SaaS', 'artificial', 'machinelearning', 'webdev'
  ]).describe('Subreddits to search'),
  limit: z.number().optional().default(50).describe('Maximum results per subreddit'),
  smartMatch: z.boolean().optional().default(true).describe('Use smart name matching'),
  website: z.string().optional().describe('Company website for better matching'),
  sort: z.enum(['relevance', 'hot', 'new', 'top']).optional().default('relevance'),
});

interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  content: string;
  author: string;
  score: number;
  comments: number;
  url: string;
  timestamp: Date;
  sentiment?: string;
}

async function scrapeRedditSubreddit(
  subreddit: string, 
  query: string, 
  sort: string = 'relevance'
): Promise<RedditPost[]> {
  try {
    const searchUrl = `https://www.reddit.com/r/${subreddit}/search/?q=${encodeURIComponent(query)}&sort=${sort}&restrict_sr=1`;
    
    const result = await brightDataSearchTool.handler({
      url: searchUrl,
      selector: '[data-testid="post-container"]',
      dataset: 'social_media',
    });
    
    // Parse the scraped content
    // This is a simplified parser - Bright Data would return structured data
    const posts: RedditPost[] = [];
    
    // Extract post data from the result
    const lines = result.split('\n');
    let currentPost: Partial<RedditPost> = {};
    
    lines.forEach(line => {
      if (line.includes('r/' + subreddit)) {
        if (currentPost.title) {
          posts.push(currentPost as RedditPost);
        }
        currentPost = {
          subreddit,
          timestamp: new Date(),
          url: searchUrl,
        };
      }
      
      // Simple extraction patterns (Bright Data would provide better structure)
      if (line.includes('upvote')) {
        const match = line.match(/(\d+)/);
        if (match) currentPost.score = parseInt(match[1]);
      }
      
      if (line.includes('comment')) {
        const match = line.match(/(\d+)\s*comment/);
        if (match) currentPost.comments = parseInt(match[1]);
      }
    });
    
    return posts;
  } catch (error) {
    console.error(`Error scraping r/${subreddit}:`, error);
    return [];
  }
}

async function searchReddit(params: z.infer<typeof RedditSearchSchema>): Promise<string> {
  const { query, subreddits, limit, smartMatch, website, sort } = params;
  
  // Generate smart queries if enabled
  let searchQuery = query;
  let nameVariations = null;
  
  if (smartMatch) {
    nameVariations = generateNameVariations(query, website);
    const smartQueries = buildSmartQueries(nameVariations);
    searchQuery = smartQueries.reddit;
    console.error(`Smart Reddit query: ${searchQuery}`);
  }
  
  // Search across all specified subreddits
  const allPosts: RedditPost[] = [];
  const subredditResults: Record<string, { posts: number; sentiment: string }> = {};
  
  for (const subreddit of subreddits) {
    console.error(`Searching r/${subreddit}...`);
    const posts = await scrapeRedditSubreddit(subreddit, searchQuery, sort);
    
    // Filter posts by relevance score if using smart matching
    const relevantPosts = smartMatch && nameVariations
      ? posts.filter(post => {
          const matchScore = scoreMatch(
            `${post.title} ${post.content}`, 
            nameVariations
          );
          return matchScore > 5; // Threshold for relevance
        })
      : posts;
    
    allPosts.push(...relevantPosts.slice(0, Math.ceil(limit / subreddits.length)));
    
    // Analyze sentiment for this subreddit
    if (relevantPosts.length > 0) {
      const positiveCount = relevantPosts.filter(p => p.score > 10).length;
      const negativeCount = relevantPosts.filter(p => p.score < 0).length;
      const sentiment = positiveCount > negativeCount ? 'positive' : 
                       negativeCount > positiveCount ? 'negative' : 'neutral';
      
      subredditResults[subreddit] = {
        posts: relevantPosts.length,
        sentiment,
      };
    }
  }
  
  // Save to MongoDB
  if (allPosts.length > 0) {
    const postsToSave = allPosts.map(post => ({
      ...post,
      platform: 'reddit',
      query,
      smart_matched: smartMatch,
    }));
    await saveToMongoDB('reddit_posts', postsToSave);
  }
  
  // Generate summary
  const totalScore = allPosts.reduce((sum, post) => sum + post.score, 0);
  const totalComments = allPosts.reduce((sum, post) => sum + post.comments, 0);
  
  let summary = `Found ${allPosts.length} relevant Reddit discussions for "${query}"\n`;
  summary += `Total upvotes: ${totalScore.toLocaleString()}\n`;
  summary += `Total comments: ${totalComments.toLocaleString()}\n\n`;
  
  summary += `Activity by subreddit:\n`;
  Object.entries(subredditResults)
    .sort((a, b) => b[1].posts - a[1].posts)
    .forEach(([sub, data]) => {
      summary += `- r/${sub}: ${data.posts} posts (${data.sentiment} sentiment)\n`;
    });
  
  // Top discussions
  const topPosts = allPosts
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  
  if (topPosts.length > 0) {
    summary += `\nTop discussions:\n`;
    topPosts.forEach(post => {
      summary += `- r/${post.subreddit}: "${post.title}" (${post.score} upvotes, ${post.comments} comments)\n`;
    });
  }
  
  // Key insights
  const techSubreddits = ['programming', 'webdev', 'machinelearning', 'artificial'];
  const techPosts = allPosts.filter(p => techSubreddits.includes(p.subreddit));
  const businessPosts = allPosts.filter(p => ['startup', 'entrepreneur', 'SaaS'].includes(p.subreddit));
  
  summary += `\nInsights:\n`;
  if (techPosts.length > 0) {
    summary += `- Technical community engagement: ${techPosts.length} posts\n`;
  }
  if (businessPosts.length > 0) {
    summary += `- Business community engagement: ${businessPosts.length} posts\n`;
  }
  
  const avgScore = allPosts.length > 0 ? Math.round(totalScore / allPosts.length) : 0;
  if (avgScore > 50) {
    summary += `- High community approval (avg ${avgScore} upvotes per post)\n`;
  } else if (avgScore < 5 && allPosts.length > 5) {
    summary += `- Low community engagement (avg ${avgScore} upvotes per post)\n`;
  }
  
  return summary;
}

export const redditSearchTool: Tool = {
  name: 'reddit_search',
  description: 'Search Reddit discussions across multiple subreddits using Bright Data',
  inputSchema: RedditSearchSchema,
  handler: searchReddit,
};
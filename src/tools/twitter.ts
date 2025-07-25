import { z } from 'zod';
import { Tool } from '../types/index.js';
import { saveToMongoDB } from '../services/mongodb.js';
import { generateNameVariations, buildSmartQueries } from '../services/smart-matching.js';
import { brightDataSearchTool } from './brightdata.js';

const TwitterSearchSchema = z.object({
  query: z.string().describe('Search query for Twitter'),
  limit: z.number().optional().default(50).describe('Maximum number of results'),
  startTime: z.string().optional().describe('ISO 8601 date string for start time'),
  endTime: z.string().optional().describe('ISO 8601 date string for end time'),
  smartMatch: z.boolean().optional().default(true).describe('Use smart name matching'),
  website: z.string().optional().describe('Company website for better matching'),
});

async function searchTwitter(params: z.infer<typeof TwitterSearchSchema>): Promise<string> {
  const { query, limit, startTime, endTime, smartMatch, website } = params;
  
  // Generate smart query if enabled
  let searchQuery = query;
  let nameVariations = null;
  
  if (smartMatch) {
    nameVariations = generateNameVariations(query, website);
    const smartQueries = buildSmartQueries(nameVariations);
    searchQuery = smartQueries.twitter;
    console.error(`Smart Twitter query: ${searchQuery}`);
  }
  
  // Always use Bright Data for Twitter scraping
  console.error('Using Bright Data for Twitter scraping...');
  return await scrapeTwitterWithBrightData(searchQuery, limit, nameVariations, startTime, endTime);
}

async function scrapeTwitterWithBrightData(
  query: string, 
  limit: number,
  nameVariations: any,
  startTime?: string,
  endTime?: string
): Promise<string> {
  try {
    // Use Bright Data to scrape Twitter search results
    const searchUrl = `https://twitter.com/search?q=${encodeURIComponent(query)}&f=live`;
    
    const brightDataResult = await brightDataSearchTool.handler({
      url: searchUrl,
      selector: 'article[data-testid="tweet"]',
      dataset: 'social_media',
    });
    
    // Parse the scraped content (simplified - Bright Data would return more structured data)
    const lines = brightDataResult.split('\n');
    const tweets: any[] = [];
    let currentTweet: any = {};
    
    lines.forEach(line => {
      // Extract tweet data from scraped content
      if (line.includes('@') && line.includes('·')) {
        // New tweet
        if (currentTweet.content) {
          tweets.push({
            ...currentTweet,
            platform: 'twitter',
            timestamp: new Date(),
            url: searchUrl,
          });
        }
        currentTweet = {
          author: line.match(/@(\w+)/)?.[1] || 'unknown',
          content: '',
          engagement: { likes: 0, shares: 0, comments: 0 },
        };
      } else if (currentTweet.author && line.trim()) {
        currentTweet.content += line + ' ';
      }
      
      // Extract engagement metrics
      if (line.includes('likes')) {
        const match = line.match(/(\d+)\s*likes/);
        if (match) currentTweet.engagement.likes = parseInt(match[1]);
      }
      if (line.includes('retweets')) {
        const match = line.match(/(\d+)\s*retweets/);
        if (match) currentTweet.engagement.shares = parseInt(match[1]);
      }
    });
    
    // Add last tweet
    if (currentTweet.content) {
      tweets.push({
        ...currentTweet,
        platform: 'twitter',
        timestamp: new Date(),
        url: searchUrl,
      });
    }
    
    // Filter by relevance if using smart matching
    let relevantTweets = tweets;
    if (nameVariations) {
      relevantTweets = tweets.filter(tweet => {
        const content = `${tweet.author} ${tweet.content}`.toLowerCase();
        return nameVariations.variations.some((variant: string) => 
          content.includes(variant.toLowerCase())
        );
      });
    }
    
    // Limit results
    relevantTweets = relevantTweets.slice(0, limit);
    
    // Save to MongoDB
    if (relevantTweets.length > 0) {
      await saveToMongoDB('social_posts', relevantTweets);
    }
    
    // Generate summary
    const totalEngagement = relevantTweets.reduce((sum: number, tweet: any) => 
      sum + tweet.engagement.likes + tweet.engagement.shares + tweet.engagement.comments, 0
    );
    
    const summary = `Found ${relevantTweets.length} tweets for "${query}" (via Bright Data)
Total engagement: ${totalEngagement.toLocaleString()}
Top tweets:
${relevantTweets.slice(0, 5).map((t: any) => 
  `- @${t.author}: "${t.content.substring(0, 100)}..." (${t.engagement.likes} likes)`
).join('\n')}

Note: Using Bright Data web scraping instead of Twitter API`;
    
    return summary;
  } catch (error: any) {
    return `Twitter search via Bright Data failed: ${error.message}`;
  }
}

export const twitterSearchTool: Tool = {
  name: 'twitter_search',
  description: 'Search Twitter/X for mentions, discussions, and sentiment using Bright Data web scraping',
  inputSchema: TwitterSearchSchema,
  handler: searchTwitter,
};
import { z } from 'zod';
import axios from 'axios';
import { Tool } from '../types/index.js';
import { saveToMongoDB } from '../services/mongodb.js';

const TavilySearchSchema = z.object({
  query: z.string().describe('Search query'),
  searchDepth: z.enum(['basic', 'advanced']).optional().default('basic'),
  includeAnswer: z.boolean().optional().default(true),
  includeRawContent: z.boolean().optional().default(false),
  maxResults: z.number().optional().default(10),
  includeDomains: z.array(z.string()).optional(),
  excludeDomains: z.array(z.string()).optional(),
});

async function searchWithTavily(params: z.infer<typeof TavilySearchSchema>): Promise<string> {
  const { 
    query, 
    searchDepth, 
    includeAnswer, 
    includeRawContent, 
    maxResults,
    includeDomains,
    excludeDomains
  } = params;
  
  if (!process.env.TAVILY_API_KEY) {
    return 'Tavily API key not configured. Please set TAVILY_API_KEY in .env';
  }
  
  try {
    const response = await axios.post('https://api.tavily.com/search', {
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: searchDepth,
      include_answer: includeAnswer,
      include_raw_content: includeRawContent,
      max_results: maxResults,
      include_domains: includeDomains,
      exclude_domains: excludeDomains,
    });
    
    const results = response.data.results || [];
    const answer = response.data.answer;
    
    // Process and save results
    const processedResults = results.map((result: any) => ({
      title: result.title,
      url: result.url,
      content: result.content,
      score: result.score,
      published_date: result.published_date,
      domain: new URL(result.url).hostname,
      query,
      raw_content: includeRawContent ? result.raw_content : undefined,
    }));
    
    if (processedResults.length > 0) {
      await saveToMongoDB('web_search_results', processedResults);
    }
    
    // Generate summary
    let summary = `Found ${results.length} results for "${query}"\n\n`;
    
    if (answer) {
      summary += `AI Summary: ${answer}\n\n`;
    }
    
    summary += 'Top results:\n';
    summary += processedResults.slice(0, 5).map((r: any) => 
      `- ${r.title}\n  ${r.url}\n  ${r.content.substring(0, 150)}...`
    ).join('\n\n');
    
    return summary;
  } catch (error: any) {
    return `Tavily search failed: ${error.message}`;
  }
}

// Specialized Tavily search for different domains
export const tavilyWebSearchTool: Tool = {
  name: 'tavily_web_search',
  description: 'General web search using Tavily API for comprehensive internet research',
  inputSchema: TavilySearchSchema,
  handler: searchWithTavily,
};

// LinkedIn-focused search
export const tavilyLinkedInSearchTool: Tool = {
  name: 'tavily_linkedin_search',
  description: 'Search LinkedIn for company pages, founder profiles, and professional information',
  inputSchema: TavilySearchSchema,
  handler: async (params) => {
    return searchWithTavily({
      ...params,
      includeDomains: ['linkedin.com'],
    });
  },
};

// News-focused search
export const tavilyNewsSearchTool: Tool = {
  name: 'tavily_news_search',
  description: 'Search news sites for press releases, funding announcements, and media coverage',
  inputSchema: TavilySearchSchema,
  handler: async (params) => {
    return searchWithTavily({
      ...params,
      includeDomains: [
        'techcrunch.com',
        'venturebeat.com',
        'forbes.com',
        'businessinsider.com',
        'reuters.com',
        'bloomberg.com',
        'wsj.com',
        'cnbc.com',
      ],
    });
  },
};

// Tech community search
export const tavilyTechSearchTool: Tool = {
  name: 'tavily_tech_search',
  description: 'Search tech community sites like Hacker News, Product Hunt, and developer forums',
  inputSchema: TavilySearchSchema,
  handler: async (params) => {
    return searchWithTavily({
      ...params,
      includeDomains: [
        'news.ycombinator.com',
        'producthunt.com',
        'reddit.com',
        'stackoverflow.com',
        'dev.to',
        'hackernoon.com',
        'medium.com',
        'github.com',
      ],
    });
  },
};
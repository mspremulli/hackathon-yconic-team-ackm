import { z } from 'zod';
import axios from 'axios';
import { Tool } from '../types/index.js';
import { saveToMongoDB } from '../services/mongodb.js';

const BrightDataSchema = z.object({
  url: z.string().url().describe('URL to scrape'),
  selector: z.string().optional().describe('CSS selector for specific content'),
  screenshot: z.boolean().optional().default(false),
  waitForSelector: z.string().optional().describe('Wait for this CSS selector before scraping'),
  dataset: z.enum(['social_media', 'company_info', 'reviews', 'general']).optional().default('general'),
});

async function scrapeWithBrightData(params: z.infer<typeof BrightDataSchema>): Promise<string> {
  const { url, selector, screenshot, waitForSelector, dataset } = params;
  
  if (!process.env.BRIGHT_DATA_API_KEY || !process.env.BRIGHT_DATA_CUSTOMER_ID) {
    return 'Bright Data credentials not configured. Please set BRIGHT_DATA_API_KEY and BRIGHT_DATA_CUSTOMER_ID in .env';
  }
  
  try {
    // Bright Data Web Unlocker API
    const response = await axios.post(
      'https://api.brightdata.com/dca/scrape',
      {
        url,
        format: 'json',
        render: true,
        screenshot,
        wait_for_selector: waitForSelector,
        selector,
        customer_id: process.env.BRIGHT_DATA_CUSTOMER_ID,
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.BRIGHT_DATA_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    const result = {
      url,
      content: response.data.content,
      title: response.data.title,
      meta: response.data.meta,
      screenshot_url: response.data.screenshot_url,
      dataset,
      scraped_at: new Date(),
    };
    
    // Save to MongoDB
    await saveToMongoDB('brightdata_scrapes', result);
    
    // Generate summary based on dataset type
    let summary = `Successfully scraped ${url}\n`;
    summary += `Title: ${result.title || 'N/A'}\n`;
    
    if (screenshot) {
      summary += `Screenshot: ${result.screenshot_url}\n`;
    }
    
    if (result.content) {
      const contentPreview = result.content.substring(0, 500);
      summary += `\nContent preview:\n${contentPreview}...`;
    }
    
    return summary;
  } catch (error: any) {
    return `Bright Data scraping failed: ${error.message}`;
  }
}

// Enhanced social media profile scraper
async function scrapeSocialProfile(platform: string, username: string): Promise<string> {
  const platformUrls: Record<string, string> = {
    twitter: `https://twitter.com/${username}`,
    linkedin: `https://www.linkedin.com/in/${username}`,
    instagram: `https://www.instagram.com/${username}`,
    github: `https://github.com/${username}`,
  };
  
  const url = platformUrls[platform.toLowerCase()];
  if (!url) {
    return `Unsupported platform: ${platform}`;
  }
  
  // Platform-specific selectors
  const selectors: Record<string, string> = {
    twitter: '[data-testid="UserProfileHeader_Items"]',
    linkedin: '.pv-top-card',
    instagram: 'article',
    github: '.js-profile-editable-area',
  };
  
  return scrapeWithBrightData({
    url,
    selector: selectors[platform.toLowerCase()],
    screenshot: true,
    dataset: 'social_media',
  });
}

export const brightDataSearchTool: Tool = {
  name: 'brightdata_scrape',
  description: 'Advanced web scraping with Bright Data for dynamic content and social media profiles',
  inputSchema: BrightDataSchema,
  handler: scrapeWithBrightData,
};

export const brightDataSocialProfileTool: Tool = {
  name: 'brightdata_social_profile',
  description: 'Scrape social media profiles with Bright Data',
  inputSchema: z.object({
    platform: z.enum(['twitter', 'linkedin', 'instagram', 'github']),
    username: z.string().describe('Username or profile ID'),
  }),
  handler: async (params) => scrapeSocialProfile(params.platform, params.username),
};
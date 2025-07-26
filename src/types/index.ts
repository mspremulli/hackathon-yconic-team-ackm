import { z } from 'zod';

// Tool type definition
export interface Tool {
  name: string;
  description: string;
  inputSchema: z.ZodObject<any>;
  handler: (params: any) => Promise<string>;
}

// Resource type definition
export interface Resource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  handler: () => Promise<string>;
}

// Prompt type definition
export interface Prompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
  handler: (args: Record<string, string>) => Promise<Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>>;
}

// Social media data types
export interface SocialMediaPost {
  id: string;
  platform: 'twitter' | 'bluesky' | 'reddit' | 'youtube';
  author: string;
  content: string;
  timestamp: Date;
  engagement: {
    likes?: number;
    shares?: number;
    comments?: number;
    views?: number;
  };
  url: string;
}

// Sentiment analysis types
export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  score: number;
  confidence: number;
  aspects?: Array<{
    aspect: string;
    sentiment: 'positive' | 'negative' | 'neutral' | string; // Allow string for flexibility
    score: number;
    insight?: string;
  }>;
  themes?: string[];
  businessContext?: string;
  nuance?: string;
  business_implications?: string;
  _mock?: boolean;
  _error?: string;
  _claudeError?: string;
  _model?: string;
  [key: string]: any; // Allow additional properties
}

// Startup analysis types
export interface StartupAnalysis {
  name: string;
  summary: string;
  social_presence: {
    twitter?: string;
    linkedin?: string;
    bluesky?: string;
    youtube?: string;
  };
  sentiment_summary: {
    overall: SentimentResult;
    by_platform: Record<string, SentimentResult>;
    key_themes: string[];
  };
  mentions: number;
  engagement_score: number;
  trending_topics: string[];
  competitive_landscape?: string[];
  market_fit_indicators: string[];
  risk_factors: string[];
  opportunities: string[];
}
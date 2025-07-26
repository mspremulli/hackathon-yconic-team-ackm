export interface StartupAnalysisInput {
  startupName: string;
  website?: string;
  socialAccounts?: {
    twitter?: string;
    linkedin?: string;
    bluesky?: string;
    youtube?: string;
  };
  founders?: Array<{
    name: string;
    twitter?: string;
    linkedin?: string;
    bluesky?: string;
  }>;
  keywords?: string[];
  competitors?: string[];
}

export interface StartupAnalysisResult {
  id: string;
  startupName: string;
  website?: string;
  socialAccounts?: any;
  founders?: any;
  analyzedAt: Date;
  dataSources: {
    twitter?: any;
    reddit?: any;
    bluesky?: any;
    youtube?: any;
    webGeneral?: any;
    linkedin?: any;
    news?: any;
    techCommunity?: any;
    founders?: Record<string, any>;
    competitiveAnalysis?: any;
  };
  sentimentAnalysis?: any;
  summary: string;
}

export interface DataFetchParams {
  query: string;
  limit?: number;
  maxResults?: number;
  smartMatch?: boolean;
  website?: string;
}

export interface SentimentAnalysisParams {
  startupName: string;
  useMinMax?: boolean;
  deepAnalysis?: boolean;
}

export interface DatabaseSaveParams {
  collection: string;
  data: any;
}
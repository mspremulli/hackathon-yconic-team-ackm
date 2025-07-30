import { proxyActivities, sleep } from '@temporalio/workflow';
import type * as activities from './activities.js';
import type { StartupAnalysisInput, StartupAnalysisResult } from './types.js';

// Create proxies for activities
const {
  fetchTwitterData,
  fetchRedditData,
  fetchBlueskyData,
  fetchYouTubeData,
  fetchTikTokData,
  fetchInstagramData,
  fetchWebData,
  fetchLinkedInData,
  fetchNewsData,
  fetchTechData,
  analyzeSentiment,
  saveToDatabase,
  generateSummary,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '5 minutes',
  retry: {
    initialInterval: '2s',
    backoffCoefficient: 2,
    maximumInterval: '1m',
    maximumAttempts: 5,
  },
});

export async function startupAnalysisWorkflow(
  input: StartupAnalysisInput
): Promise<StartupAnalysisResult> {
  const { startupName, website, socialAccounts, founders, keywords, competitors } = input;
  
  console.log(`Starting comprehensive analysis for: ${startupName}`);
  
  const analysisId = `analysis_${Date.now()}`;
  const results: any = {
    id: analysisId,
    startupName,
    website,
    socialAccounts,
    founders,
    analyzedAt: new Date(),
    dataSources: {},
  };
  
  // Phase 1: Parallel social media data collection
  const socialMediaPromises = [];
  
  // Twitter with smart matching
  socialMediaPromises.push(
    fetchTwitterData({ 
      query: startupName, 
      limit: 100,
      smartMatch: true,
      website 
    }).then((r: string) => { results.dataSources.twitter = r; })
      .catch((e: any) => { results.dataSources.twitter = `Error: ${e.message}`; })
  );
  
  // Reddit with smart matching
  socialMediaPromises.push(
    fetchRedditData({ 
      query: startupName, 
      limit: 50,
      smartMatch: true,
      website 
    }).then((r: string) => { results.dataSources.reddit = r; })
      .catch((e: any) => { results.dataSources.reddit = `Error: ${e.message}`; })
  );
  
  // Bluesky
  socialMediaPromises.push(
    fetchBlueskyData({ query: startupName, limit: 50 })
      .then((r: string) => { results.dataSources.bluesky = r; })
      .catch((e: any) => { results.dataSources.bluesky = `Error: ${e.message}`; })
  );
  
  // YouTube
  socialMediaPromises.push(
    fetchYouTubeData({ query: `${startupName} demo review`, limit: 25 })
      .then((r: string) => { results.dataSources.youtube = r; })
      .catch((e: any) => { results.dataSources.youtube = `Error: ${e.message}`; })
  );
  
  // TikTok
  socialMediaPromises.push(
    fetchTikTokData({ 
      query: startupName, 
      limit: 50,
      smartMatch: true,
      website 
    }).then((r: string) => { results.dataSources.tiktok = r; })
      .catch((e: any) => { results.dataSources.tiktok = `Error: ${e.message}`; })
  );
  
  // Instagram
  socialMediaPromises.push(
    fetchInstagramData({ 
      query: startupName, 
      limit: 50,
      smartMatch: true,
      website 
    }).then((r: string) => { results.dataSources.instagram = r; })
      .catch((e: any) => { results.dataSources.instagram = `Error: ${e.message}`; })
  );
  
  await Promise.all(socialMediaPromises);
  
  // Add delay between phases to respect rate limits
  await sleep('2s');
  
  // Phase 2: Web searches (can be more aggressive with rate limits)
  const webSearchPromises = [];
  
  webSearchPromises.push(
    fetchWebData({ query: startupName, maxResults: 20 })
      .then((r: string) => { results.dataSources.webGeneral = r; })
      .catch((e: any) => { results.dataSources.webGeneral = `Error: ${e.message}`; })
  );
  
  webSearchPromises.push(
    fetchLinkedInData({ query: startupName })
      .then((r: string) => { results.dataSources.linkedin = r; })
      .catch((e: any) => { results.dataSources.linkedin = `Error: ${e.message}`; })
  );
  
  webSearchPromises.push(
    fetchNewsData({ query: `${startupName} funding announcement`, maxResults: 10 })
      .then((r: string) => { results.dataSources.news = r; })
      .catch((e: any) => { results.dataSources.news = `Error: ${e.message}`; })
  );
  
  webSearchPromises.push(
    fetchTechData({ query: startupName, maxResults: 15 })
      .then((r: string) => { results.dataSources.techCommunity = r; })
      .catch((e: any) => { results.dataSources.techCommunity = `Error: ${e.message}`; })
  );
  
  await Promise.all(webSearchPromises);
  
  // Phase 3: Founder analysis (if provided)
  if (founders && founders.length > 0) {
    await sleep('1s');
    
    const founderPromises = founders.map((founder: any) =>
      fetchLinkedInData({ query: `${founder.name} ${startupName}` })
        .then((r: string) => { 
          if (!results.dataSources.founders) results.dataSources.founders = {};
          results.dataSources.founders[founder.name] = r; 
        })
        .catch((e: any) => { 
          if (!results.dataSources.founders) results.dataSources.founders = {};
          results.dataSources.founders[founder.name] = `Error: ${e.message}`; 
        })
    );
    
    await Promise.all(founderPromises);
  }
  
  // Phase 4: Competitive analysis
  if (competitors && competitors.length > 0) {
    await sleep('1s');
    
    const competitiveAnalysis = await fetchWebData({ 
      query: `${startupName} vs ${competitors.join(' OR ')} comparison`, 
      maxResults: 15 
    }).catch((e: any) => `Error: ${e.message}`);
    
    results.dataSources.competitiveAnalysis = competitiveAnalysis;
  }
  
  // Phase 5: Sentiment analysis
  await sleep('2s'); // Rate limit buffer
  
  try {
    const sentimentResult = await analyzeSentiment({ 
      startupName, 
      useMinMax: false,
      deepAnalysis: true
    });
    results.sentimentAnalysis = sentimentResult;
  } catch (error: any) {
    results.sentimentAnalysis = `Error: ${error.message}`;
  }
  
  // Phase 6: Save to database
  await saveToDatabase({
    collection: 'startup_analyses',
    data: results
  });
  
  // Phase 7: Generate executive summary
  const summary = await generateSummary(results);
  
  return {
    ...results,
    summary
  };
}

// Workflow for monitoring startup over time
export async function startupMonitoringWorkflow(
  input: { startupName: string; interval: string; duration: string }
): Promise<void> {
  const { startupName, interval, duration } = input;
  
  const intervalMs = parseInterval(interval);
  const durationMs = parseInterval(duration);
  const endTime = Date.now() + durationMs;
  
  while (Date.now() < endTime) {
    // Run analysis
    await startupAnalysisWorkflow({
      startupName,
      website: undefined,
      socialAccounts: undefined,
      founders: undefined,
      keywords: undefined,
      competitors: undefined
    });
    
    // Wait for next interval
    await sleep(intervalMs);
  }
}

function parseInterval(interval: string): number {
  const units: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  
  const match = interval.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid interval format: ${interval}`);
  }
  
  const [, value, unit] = match;
  return parseInt(value) * units[unit];
}
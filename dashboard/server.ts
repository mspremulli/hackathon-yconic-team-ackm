import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'dotenv/config';

// Import our tools
import { startupAnalysisTool } from '../src/tools/startup-analysis.js';
import { dashboardSummaryTool } from '../src/tools/dashboard.js';
import { sentimentAnalysisTool } from '../src/tools/sentiment.js';
import { sensoSummaryTool } from '../src/tools/senso.js';
import { queryMongoDB } from '../src/services/mongodb.js';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3456;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// API endpoint for startup analysis
app.get('/analyze/:startup', async (req, res) => {
  try {
    const { startup } = req.params;
    console.log(`Analyzing startup: ${startup}`);
    
    // Get comprehensive analysis
    const analysisResult = await startupAnalysisTool.handler({
      startup_name: startup,
      keywords: [startup]
    });
    
    // The analysis result is already a complete formatted summary
    const fullSummary = analysisResult;
    
    // Debug: Log the actual summary content
    console.log('Analysis Result Length:', analysisResult.length);
    console.log('First 500 chars:', analysisResult.substring(0, 500));
    
    // Extract key metrics from the summary
    const lines = analysisResult.split('\n');
    let dataCollected = false;
    let successfulSources = 0;
    
    for (const line of lines) {
      if (line.includes('Successfully collected data from')) {
        const match = line.match(/Successfully collected data from (\d+) sources/);
        if (match) {
          successfulSources = parseInt(match[1]);
          dataCollected = successfulSources > 0;
        }
      }
    }
    
    // Get recent posts from MongoDB
    const recentPosts = await queryMongoDB('posts', 
      { $or: [
        { startup_name: startup },
        { content: { $regex: startup, $options: 'i' } }
      ]},
      { limit: 10, sort: { timestamp: -1 } }
    );
    
    // Get sentiment data
    let sentimentData = {
      overall: 'NEUTRAL',
      confidence: 0.5,
      positive: 0,
      negative: 0,
      neutral: 0
    };
    
    try {
      const sentimentResult = await sentimentAnalysisTool.handler({
        startup_name: startup
      });
      
      // Parse sentiment result
      const sentimentLines = sentimentResult.split('\n');
      for (const line of sentimentLines) {
        if (line.includes('Overall Sentiment:')) {
          const match = line.match(/Overall Sentiment: (\w+) \((\d+\.?\d*)% confidence\)/);
          if (match) {
            sentimentData.overall = match[1];
            sentimentData.confidence = parseFloat(match[2]) / 100;
          }
        }
        if (line.includes('Positive:')) {
          const match = line.match(/Positive: (\d+)/);
          if (match) sentimentData.positive = parseInt(match[1]);
        }
        if (line.includes('Negative:')) {
          const match = line.match(/Negative: (\d+)/);
          if (match) sentimentData.negative = parseInt(match[1]);
        }
        if (line.includes('Neutral:')) {
          const match = line.match(/Neutral: (\d+)/);
          if (match) sentimentData.neutral = parseInt(match[1]);
        }
      }
    } catch (error) {
      console.error('Sentiment analysis error:', error);
    }
    
    // Calculate social activity metrics
    const totalPosts = recentPosts.length;
    const totalEngagement = recentPosts.reduce((sum, post) => {
      if (post.engagement) {
        return sum + (post.engagement.likes || 0) + 
               (post.engagement.shares || 0) + 
               (post.engagement.comments || 0);
      }
      return sum;
    }, 0);
    
    // Try to generate Senso.ai summary if API key is available
    let sensoSummary = null;
    if (process.env.SENSO_API_KEY) {
      try {
        console.log('Generating Senso.ai summary...');
        const sensoResult = await sensoSummaryTool.handler({
          startup_name: startup,
          summary_type: 'executive'
        });
        sensoSummary = sensoResult;
      } catch (error) {
        console.error('Senso.ai summary generation failed:', error);
      }
    }
    
    // Get all market research data from external APIs in parallel
    const marketResearchData: any = {};
    
    // Common request body for all endpoints
    const requestBody = {
      company: startup,
      description: `${startup} is a technology company`, // Basic description
      industry: 'Technology', // Default to tech
      stage: 'series-a', // Default stage
      location: 'United States' // Default location
    };
    
    console.log('Market research request body:', JSON.stringify(requestBody));
    
    // Run all market research API calls in parallel
    const marketResearchPromises = [
      // 1. Market Analysis
      fetch('https://wvvmrpf334.us-east-1.awsapprunner.com/market-research/market-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        // signal: AbortSignal.timeout(15000) // 15 second timeout
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.text();
          try {
            marketResearchData.marketAnalysis = JSON.parse(data);
          } catch {
            marketResearchData.marketAnalysis = data;
          }
          console.log('Market analysis received:', data.substring(0, 100));
        } else {
          console.error('Market analysis failed:', res.status, res.statusText);
          const errorText = await res.text();
          console.error('Market analysis error response:', errorText.substring(0, 200));
        }
      }).catch(err => {
        console.error('Market analysis error:', err.message || err);
        console.error('Full error:', err);
      }),
      
      // 2. Competitor Analysis
      fetch('https://wvvmrpf334.us-east-1.awsapprunner.com/market-research/competitor-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.text();
          try {
            marketResearchData.competitorAnalysis = JSON.parse(data);
          } catch {
            marketResearchData.competitorAnalysis = data;
          }
          console.log('Competitor analysis received:', data.substring(0, 100));
        } else {
          console.error('Competitor analysis failed:', res.status, res.statusText);
        }
      }).catch(err => console.error('Competitor analysis error:', err)),
      
      // 3. Financial Projections
      fetch('https://wvvmrpf334.us-east-1.awsapprunner.com/market-research/financial-projections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.text();
          try {
            marketResearchData.financialProjections = JSON.parse(data);
          } catch {
            marketResearchData.financialProjections = data;
          }
          console.log('Financial projections received:', data.substring(0, 100));
        } else {
          console.error('Financial projections failed:', res.status, res.statusText);
        }
      }).catch(err => console.error('Financial projections error:', err)),
      
      // 4. Investment Recommendations
      fetch('https://wvvmrpf334.us-east-1.awsapprunner.com/market-research/investment-recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.text();
          try {
            marketResearchData.investmentRecommendation = JSON.parse(data);
          } catch {
            marketResearchData.investmentRecommendation = data;
          }
          console.log('Investment recommendations received:', data.substring(0, 100));
        } else {
          console.error('Investment recommendations failed:', res.status, res.statusText);
        }
      }).catch(err => console.error('Investment recommendation error:', err)),
      
      // 5. Risk Assessment
      fetch('https://wvvmrpf334.us-east-1.awsapprunner.com/market-research/risk-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }).then(async (res) => {
        if (res.ok) {
          const data = await res.text();
          try {
            marketResearchData.riskAssessment = JSON.parse(data);
          } catch {
            marketResearchData.riskAssessment = data;
          }
          console.log('Risk assessment received:', data.substring(0, 100));
        } else {
          console.error('Risk assessment failed:', res.status, res.statusText);
        }
      }).catch(err => console.error('Risk assessment error:', err))
    ];
    
    // Wait for all market research calls to complete
    console.log('Fetching all market research data in parallel...');
    await Promise.all(marketResearchPromises);
    
    console.log('Market research data collected:', Object.keys(marketResearchData));
    console.log('Market research data details:', JSON.stringify(marketResearchData, null, 2).substring(0, 500));
    
    // Return structured data
    res.json({
      startup: startup,
      sentiment: sentimentData,
      socialActivity: {
        totalPosts,
        totalEngagement
      },
      recentPosts: recentPosts.slice(0, 5), // Top 5 recent posts
      summary: fullSummary, // Full executive summary from analysis
      sensoSummary: sensoSummary, // AI-powered summary from Senso.ai
      marketResearch: marketResearchData, // All market research data
      metrics: {
        successfulSources,
        dataCollected
      }
    });
    
  } catch (error: any) {
    console.error('Analysis error:', error);
    res.status(500).json({ 
      error: error.message || 'Analysis failed',
      startup: req.params.startup 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Dashboard server running at http://localhost:${PORT}`);
  console.log(`📊 Open http://localhost:${PORT} in your browser`);
});
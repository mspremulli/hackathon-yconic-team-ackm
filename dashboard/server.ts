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
import { queryMongoDB } from '../src/services/mongodb.js';

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
    
    // Parse the analysis result (it comes as a formatted string)
    const lines = analysisResult.split('\n');
    let summary = '';
    let dataCollected = false;
    
    // Extract summary from the formatted text
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Data Collection Summary')) {
        dataCollected = true;
      }
      if (lines[i].includes('## Summary') || lines[i].includes('## Executive Summary')) {
        summary = lines.slice(i + 1).join('\n').trim();
        break;
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
    
    // Return structured data
    res.json({
      startup: startup,
      sentiment: sentimentData,
      socialActivity: {
        totalPosts,
        totalEngagement
      },
      recentPosts: recentPosts.slice(0, 5), // Top 5 recent posts
      summary: summary || `Analysis complete for ${startup}. ${dataCollected ? 'Data collected from multiple sources.' : 'Limited data available.'}`
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
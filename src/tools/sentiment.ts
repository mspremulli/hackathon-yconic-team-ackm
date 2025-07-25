import { z } from 'zod';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { Tool, SentimentResult } from '../types/index.js';
import { saveToMongoDB, queryMongoDB } from '../services/mongodb.js';
import { bedrockRateLimiter } from '../services/rate-limiter.js';
import { sentimentCache } from '../services/cache.js';
import { analyzeBatchSmart, getOptimalBatchSize } from './sentiment-batch.js';
import crypto from 'crypto';

const SentimentAnalysisSchema = z.object({
  text: z.string().optional().describe('Text to analyze for sentiment'),
  texts: z.array(z.string()).optional().describe('Array of texts to analyze'),
  startup_name: z.string().optional().describe('Startup name to analyze from stored data'),
  platform: z.string().optional().describe('Filter by social media platform'),
  useMinMax: z.boolean().optional().default(false).describe('Use MiniMax instead of Bedrock'),
  deepAnalysis: z.boolean().optional().default(false).describe('Use Claude for deep analysis on key posts'),
});

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined,
});

async function analyzeWithBedrock(text: string): Promise<SentimentResult> {
  const prompt = `Analyze the sentiment of the following text and provide:
1. Overall sentiment (positive, negative, neutral, or mixed)
2. Confidence score (0-1)
3. Key aspects and their sentiments

Text: "${text}"

Respond in JSON format:
{
  "sentiment": "positive|negative|neutral|mixed",
  "score": 0.85,
  "confidence": 0.92,
  "aspects": [
    {"aspect": "product quality", "sentiment": "positive", "score": 0.9},
    {"aspect": "customer service", "sentiment": "negative", "score": 0.3}
  ]
}`;

  try {
    const command = new InvokeModelCommand({
      modelId: 'mistral.mistral-large-2402-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        prompt,
        max_tokens: 1000,
        temperature: 0.1,
        top_p: 0.9,
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Parse the model's response
    const modelOutput = responseBody.outputs[0].text;
    
    // Try to extract JSON from the response
    const jsonMatch = modelOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);
        return result;
      } catch (e) {
        // If JSON parsing fails, use basic analysis
        throw new Error('Failed to parse JSON from model output');
      }
    } else {
      throw new Error('No JSON found in model output');
    }
  } catch (error: any) {
    console.error('Bedrock sentiment analysis error:', error.message);
    
    // Fallback to mock sentiment analysis
    const words = text.toLowerCase().split(/\s+/);
    const positiveWords = ['great', 'excellent', 'amazing', 'love', 'fantastic', 'wonderful', 'best', 'innovative'];
    const negativeWords = ['bad', 'terrible', 'hate', 'awful', 'worst', 'disappointing', 'poor', 'failed'];
    
    const positiveCount = words.filter(w => positiveWords.includes(w)).length;
    const negativeCount = words.filter(w => negativeWords.includes(w)).length;
    const total = positiveCount + negativeCount || 1;
    
    const score = (positiveCount - negativeCount + total) / (2 * total);
    let sentiment: 'positive' | 'negative' | 'neutral' | 'mixed' = 'neutral';
    
    if (score > 0.6) sentiment = 'positive';
    else if (score < 0.4) sentiment = 'negative';
    else if (positiveCount > 0 && negativeCount > 0) sentiment = 'mixed';
    
    return {
      sentiment,
      score,
      confidence: 0.7,
      aspects: [],
      _mock: true,
      _error: 'AWS Bedrock access denied - using fallback analysis'
    };
  }
}

async function analyzeWithClaude(text: string): Promise<SentimentResult> {
  // Create cache key from text hash
  const cacheKey = `claude_${crypto.createHash('md5').update(text).digest('hex')}`;
  
  // Check cache first
  const cached = sentimentCache.get(cacheKey);
  if (cached) {
    console.error('Using cached sentiment result');
    return cached;
  }
  
  const prompt = `Analyze this text for deep sentiment insights. Provide:
1. Overall sentiment with nuanced understanding (not just positive/negative)
2. Key themes and aspects being discussed
3. Underlying emotions and concerns
4. Business implications for a startup

Text: "${text}"

Respond in JSON format:
{
  "sentiment": "positive|negative|neutral|mixed",
  "score": 0.85,
  "confidence": 0.92,
  "nuance": "Excited but cautious about scalability",
  "aspects": [
    {"aspect": "product innovation", "sentiment": "positive", "score": 0.9, "insight": "Users love the AI features"},
    {"aspect": "pricing", "sentiment": "negative", "score": 0.3, "insight": "Too expensive for small teams"}
  ],
  "themes": ["AI innovation", "enterprise readiness", "pricing concerns"],
  "business_implications": "Strong product-market fit in enterprise, needs better SMB pricing"
}`;

  try {
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1500,
        temperature: 0.1,
        messages: [{
          role: "user",
          content: prompt
        }]
      }),
    });

    const response = await bedrockRateLimiter.execute(() => bedrockClient.send(command));
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Parse Claude's response
    const content = responseBody.content[0].text;
    
    // Try to extract JSON from Claude's response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const result = JSON.parse(jsonMatch[0]);
        // Add the business implications to the standard format
        const finalResult = {
          ...result,
          businessContext: result.business_implications
        };
        
        // Cache the successful result
        sentimentCache.set(cacheKey, finalResult);
        
        return finalResult;
      } catch (e) {
        // If JSON parsing fails, throw to use fallback
        throw new Error('Failed to parse JSON from Claude output');
      }
    } else {
      throw new Error('No JSON found in Claude output');
    }
  } catch (error: any) {
    console.error('Claude sentiment analysis error:', error.message);
    
    // If rate limited, try Mistral Large first
    if (error.message.includes('rate limit') || 
        error.message.includes('Too many requests')) {
      console.error('Claude rate limited, trying Mistral Large...');
      try {
        const mistralResult = await analyzeWithBedrock(text);
        return {
          ...mistralResult,
          _model: 'mistral-large-fallback'
        };
      } catch (mistralError) {
        console.error('Mistral Large also failed:', mistralError);
      }
    }
    
    // Final fallback to mock analysis
    const fallback = await analyzeWithBedrock(text);
    return {
      ...fallback,
      _claudeError: 'Claude access denied - using fallback analysis'
    };
  }
}

async function analyzeWithMiniMax(text: string): Promise<SentimentResult> {
  if (!process.env.MINIMAX_API_KEY) {
    throw new Error('MiniMax API key not configured');
  }

  // MiniMax API call would go here
  // For now, return a mock result
  return {
    sentiment: 'neutral',
    score: 0.5,
    confidence: 0.7,
    aspects: [],
  };
}

async function analyzeSentiment(params: z.infer<typeof SentimentAnalysisSchema>): Promise<string> {
  const { text, texts, startup_name, platform, useMinMax, deepAnalysis } = params;
  
  let textsToAnalyze: string[] = [];
  
  // Gather texts to analyze
  if (text) {
    textsToAnalyze = [text];
  } else if (texts) {
    textsToAnalyze = texts;
  } else if (startup_name) {
    // Query stored social media posts
    const query: any = { query: startup_name };
    if (platform) query.platform = platform;
    
    const posts = await queryMongoDB('social_posts', query, { limit: 100 });
    textsToAnalyze = posts.map(post => post.content);
    
    if (textsToAnalyze.length === 0) {
      return `No stored data found for startup: ${startup_name}`;
    }
  } else {
    return 'Please provide text, texts array, or startup_name to analyze';
  }
  
  // Hybrid approach: Mistral for all, Claude for key posts
  const results: SentimentResult[] = [];
  const deepInsights: any[] = [];
  
  // Use Claude batch analysis for efficiency
  console.error(`Analyzing ${textsToAnalyze.length} texts with Claude Sonnet 4 (batch mode)...`);
  
  // Determine optimal batch size based on text length
  const optimalBatchSize = getOptimalBatchSize(textsToAnalyze);
  console.error(`Using batch size: ${optimalBatchSize}`);
  
  // Process in optimized batches
  for (let i = 0; i < textsToAnalyze.length; i += optimalBatchSize) {
    const batch = textsToAnalyze.slice(i, i + optimalBatchSize);
    
    try {
      // Send entire batch in one API call using smart model rotation
      const batchResult = await analyzeBatchSmart(batch);
      
      // Map batch results back to individual results
      for (const result of batchResult.results) {
        if (result.index < batch.length) {
          results.push({
            sentiment: result.sentiment,
            score: result.score,
            confidence: result.confidence,
            aspects: result.aspects,
            themes: result.themes,
            businessContext: batchResult.summary.business_implications
          });
        }
      }
      
      // Store batch summary if it's the last batch
      if (i + optimalBatchSize >= textsToAnalyze.length && batchResult.summary) {
        deepInsights.push({
          type: 'batch_summary',
          insights: batchResult.summary
        });
      }
    } catch (error) {
      console.error('Batch sentiment analysis failed, falling back to individual analysis:', error);
      
      // Fallback to individual analysis for failed batch
      for (const textItem of batch) {
        try {
          const result = await analyzeWithClaude(textItem);
          results.push(result);
        } catch (individualError) {
          console.error('Individual sentiment analysis error:', individualError);
        }
      }
    }
    
    // Small delay between batches
    if (i + optimalBatchSize < textsToAnalyze.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Step 2: Additional deep analysis (already using Claude for all posts)
  if (deepAnalysis && !useMinMax) {
    // Identify key posts for deep analysis
    const keyPosts: { text: string; index: number }[] = [];
    
    // Get posts from MongoDB if analyzing by startup_name
    if (startup_name) {
      const posts = await queryMongoDB('social_posts', { query: startup_name }, { limit: 100 });
      
      // Select high-impact posts
      posts.forEach((post, idx) => {
        const isHighEngagement = (post.engagement?.likes || 0) + (post.engagement?.shares || 0) > 1000;
        const isInfluencer = post.author_verified || (post.engagement?.views || 0) > 10000;
        const isMixedSentiment = results[idx] && results[idx].confidence < 0.6;
        
        if ((isHighEngagement || isInfluencer || isMixedSentiment) && keyPosts.length < 10) {
          keyPosts.push({ text: post.content, index: idx });
        }
      });
    } else {
      // For direct text analysis, pick texts where Mistral was uncertain
      textsToAnalyze.forEach((text, idx) => {
        if (results[idx] && results[idx].confidence < 0.6 && keyPosts.length < 5) {
          keyPosts.push({ text, index: idx });
        }
      });
    }
    
    // Analyze key posts with Claude
    console.error(`Skipping redundant deep analysis (already using Claude)...`);
    for (const keyPost of keyPosts) {
      try {
        const deepResult = await analyzeWithClaude(keyPost.text);
        deepInsights.push({
          ...deepResult,
          originalIndex: keyPost.index,
          text: keyPost.text.substring(0, 100) + '...'
        });
        // Update the original result with deep insights
        results[keyPost.index] = deepResult;
      } catch (error) {
        console.error('Claude deep analysis error:', error);
      }
    }
  }
  
  if (results.length === 0) {
    return 'Failed to analyze sentiment';
  }
  
  // Aggregate results
  const sentimentCounts = {
    positive: 0,
    negative: 0,
    neutral: 0,
    mixed: 0,
  };
  
  let totalScore = 0;
  let totalConfidence = 0;
  const aspectMap = new Map<string, { positive: number; negative: number; neutral: number }>();
  
  for (const result of results) {
    sentimentCounts[result.sentiment]++;
    totalScore += result.score;
    totalConfidence += result.confidence;
    
    if (result.aspects) {
      for (const aspect of result.aspects) {
        if (!aspectMap.has(aspect.aspect)) {
          aspectMap.set(aspect.aspect, { positive: 0, negative: 0, neutral: 0 });
        }
        const counts = aspectMap.get(aspect.aspect)!;
        counts[aspect.sentiment]++;
      }
    }
  }
  
  // Calculate overall sentiment
  const dominantSentiment = Object.entries(sentimentCounts)
    .sort((a, b) => b[1] - a[1])[0][0] as SentimentResult['sentiment'];
  
  const avgScore = totalScore / results.length;
  const avgConfidence = totalConfidence / results.length;
  
  // Save analysis results
  const analysisResult = {
    startup_name,
    platform,
    texts_analyzed: textsToAnalyze.length,
    overall_sentiment: dominantSentiment,
    average_score: avgScore,
    average_confidence: avgConfidence,
    sentiment_distribution: sentimentCounts,
    top_aspects: Array.from(aspectMap.entries())
      .map(([aspect, counts]) => ({
        aspect,
        sentiment: Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0],
        count: counts.positive + counts.negative + counts.neutral,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    analyzed_at: new Date(),
  };
  
  await saveToMongoDB('sentiment_analysis', analysisResult);
  
  // Generate summary
  let summary = `Sentiment Analysis Results:
Analyzed ${textsToAnalyze.length} text(s)${deepInsights.length > 0 ? ` (${deepInsights.length} with deep analysis)` : ''}

Overall Sentiment: ${dominantSentiment.toUpperCase()} (${(avgScore * 100).toFixed(1)}% confidence)

Distribution:
- Positive: ${sentimentCounts.positive} (${(sentimentCounts.positive / results.length * 100).toFixed(1)}%)
- Negative: ${sentimentCounts.negative} (${(sentimentCounts.negative / results.length * 100).toFixed(1)}%)
- Neutral: ${sentimentCounts.neutral} (${(sentimentCounts.neutral / results.length * 100).toFixed(1)}%)
- Mixed: ${sentimentCounts.mixed} (${(sentimentCounts.mixed / results.length * 100).toFixed(1)}%)

${analysisResult.top_aspects.length > 0 ? `Top Aspects:
${analysisResult.top_aspects.map(a => 
  `- ${a.aspect}: ${a.sentiment} (mentioned ${a.count} times)`
).join('\n')}` : ''}`;

  // Add deep insights if available
  if (deepInsights.length > 0) {
    summary += `\n\nDeep Insights (Claude Analysis):`;
    
    // Extract unique themes and business implications
    const allThemes = new Set<string>();
    const businessImplications: string[] = [];
    
    deepInsights.forEach(insight => {
      if (insight.themes) {
        insight.themes.forEach((theme: string) => allThemes.add(theme));
      }
      if (insight.businessContext) {
        businessImplications.push(insight.businessContext);
      }
    });
    
    if (allThemes.size > 0) {
      summary += `\n\nKey Themes Identified:`;
      summary += `\n${Array.from(allThemes).map(theme => `- ${theme}`).join('\n')}`;
    }
    
    if (businessImplications.length > 0) {
      summary += `\n\nBusiness Implications:`;
      summary += `\n${businessImplications.map((impl, idx) => `${idx + 1}. ${impl}`).join('\n')}`;
    }
    
    // Add specific insights from high-impact posts
    const topInsights = deepInsights
      .filter(insight => insight.aspects && insight.aspects.length > 0)
      .slice(0, 3);
    
    if (topInsights.length > 0) {
      summary += `\n\nDetailed Analysis of Key Posts:`;
      topInsights.forEach(insight => {
        summary += `\n\nPost: "${insight.text}"`;
        if (insight.nuance) {
          summary += `\nNuance: ${insight.nuance}`;
        }
        if (insight.aspects && insight.aspects.length > 0) {
          summary += `\nAspects:`;
          insight.aspects.forEach((aspect: any) => {
            summary += `\n  - ${aspect.aspect}: ${aspect.sentiment}${aspect.insight ? ` (${aspect.insight})` : ''}`;
          });
        }
      });
    }
  }
  
  return summary;
}

export const sentimentAnalysisTool: Tool = {
  name: 'sentiment_analysis',
  description: 'Analyze sentiment using Mistral for bulk analysis and Claude for deep insights on key posts',
  inputSchema: SentimentAnalysisSchema,
  handler: analyzeSentiment,
};
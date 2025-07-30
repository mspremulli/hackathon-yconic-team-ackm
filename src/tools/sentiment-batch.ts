import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { bedrockRateLimiter } from '../services/rate-limiter.js';
import { sentimentCache } from '../services/cache.js';
import { sentimentModelRotator } from '../services/model-rotator.js';
import crypto from 'crypto';

// Initialize Bedrock client
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  } : undefined,
});

interface BatchSentimentResult {
  results: Array<{
    index: number;
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
    score: number;
    confidence: number;
    aspects?: Array<{aspect: string; sentiment: string; score: number}>;
    themes?: string[];
  }>;
  summary: {
    overall_sentiment: string;
    key_themes: string[];
    business_implications: string;
  };
}

export async function analyzeBatchWithClaude(texts: string[], useMistralFallback = true): Promise<BatchSentimentResult> {
  // Create cache key from combined texts
  const cacheKey = `claude_batch_${crypto.createHash('md5').update(texts.join('|||')).digest('hex')}`;
  
  // Check cache first
  const cached = sentimentCache.get(cacheKey);
  if (cached) {
    console.error('Using cached batch sentiment result');
    return cached;
  }
  
  // Format texts for batch analysis
  const formattedTexts = texts.map((text, index) => 
    `[Text ${index + 1}]: "${text.substring(0, 500)}${text.length > 500 ? '...' : ''}"`
  ).join('\n\n');
  
  const prompt = `You are a sentiment analysis API. Analyze these ${texts.length} texts and return ONLY valid JSON with no additional text or explanation.

${formattedTexts}

Return JSON in exactly this format:
{
  "results": [
    {
      "index": 0,
      "sentiment": "positive",
      "score": 0.85,
      "confidence": 0.92,
      "aspects": [
        {"aspect": "product quality", "sentiment": "positive", "score": 0.9}
      ],
      "themes": ["innovation", "pricing"]
    }
  ],
  "summary": {
    "overall_sentiment": "mostly positive",
    "key_themes": ["AI technology", "customer satisfaction", "pricing concerns"],
    "business_implications": "Strong positive reception with some pricing sensitivity"
  }
}

IMPORTANT: Return ONLY the JSON object. No markdown, no explanations, no additional text.`;

  try {
    const command = new InvokeModelCommand({
      modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4000,
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
    
    // Log the raw response for debugging
    console.error('Claude raw response length:', content.length);
    if (content.length < 1000) {
      console.error('Claude raw response:', content);
    } else {
      console.error('Claude raw response preview:', content.substring(0, 200) + '...');
    }
    
    // Try multiple JSON extraction strategies
    let result: BatchSentimentResult | null = null;
    
    // Strategy 1: Try to parse the entire response as JSON
    try {
      result = JSON.parse(content) as BatchSentimentResult;
      console.error('Successfully parsed entire response as JSON');
    } catch (e1) {
      // Strategy 2: Extract JSON using regex
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]) as BatchSentimentResult;
          console.error('Successfully extracted JSON using regex');
        } catch (e2) {
          // Strategy 3: Try to find JSON between code blocks
          const codeBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
          if (codeBlockMatch) {
            try {
              result = JSON.parse(codeBlockMatch[1]) as BatchSentimentResult;
              console.error('Successfully extracted JSON from code block');
            } catch (e3) {
              console.error('Failed to parse JSON from code block:', e3);
            }
          }
        }
      }
    }
    
    if (result && result.results) {
      // Validate the result structure
      if (!Array.isArray(result.results)) {
        throw new Error('Invalid result structure: results is not an array');
      }
      
      // Cache the successful result
      sentimentCache.set(cacheKey, result, 600); // 10 minutes
      
      return result;
    } else {
      // Log more details for debugging
      console.error('Failed to extract valid JSON from Claude response');
      console.error('Response preview:', content.substring(0, 500));
      throw new Error('Failed to parse JSON from Claude batch output');
    }
  } catch (error: any) {
    console.error('Claude batch sentiment analysis error:', error.message);
    
    // If rate limited and fallback enabled, try Mistral Large
    if (useMistralFallback && 
        (error.message.includes('rate limit') || 
         error.message.includes('Too many requests'))) {
      console.error('Rate limited on Claude, falling back to Mistral Large...');
      return await analyzeBatchWithMistral(texts);
    }
    
    // Otherwise return error result
    return {
      results: texts.map((text, index) => ({
        index,
        sentiment: 'neutral' as const,
        score: 0.5,
        confidence: 0.5,
        _error: 'Batch analysis failed'
      })),
      summary: {
        overall_sentiment: 'unknown',
        key_themes: [],
        business_implications: 'Analysis unavailable due to API error'
      }
    };
  }
}

export async function analyzeBatchWithMistral(texts: string[]): Promise<BatchSentimentResult> {
  // Create cache key for Mistral results
  const cacheKey = `mistral_batch_${crypto.createHash('md5').update(texts.join('|||')).digest('hex')}`;
  
  // Check cache first
  const cached = sentimentCache.get(cacheKey);
  if (cached) {
    console.error('Using cached Mistral batch sentiment result');
    return cached;
  }
  
  // Format texts for batch analysis
  const formattedTexts = texts.map((text, index) => 
    `[Text ${index + 1}]: "${text.substring(0, 500)}${text.length > 500 ? '...' : ''}"`
  ).join('\n\n');
  
  const prompt = `You are a sentiment analysis API. Analyze these ${texts.length} texts and return ONLY valid JSON.

${formattedTexts}

Return JSON in exactly this format:
{
  "results": [
    {
      "index": 0,
      "sentiment": "positive",
      "score": 0.85,
      "confidence": 0.92,
      "aspects": [
        {"aspect": "product quality", "sentiment": "positive", "score": 0.9}
      ],
      "themes": ["innovation", "pricing"]
    }
  ],
  "summary": {
    "overall_sentiment": "mostly positive",
    "key_themes": ["AI technology", "customer satisfaction", "pricing concerns"],
    "business_implications": "Strong positive reception with some pricing sensitivity"
  }
}

Return ONLY the JSON. No other text.`;

  try {
    const command = new InvokeModelCommand({
      modelId: 'mistral.mistral-large-2402-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        prompt,
        max_tokens: 4000,
        temperature: 0.1,
        top_p: 0.9,
      }),
    });

    const response = await bedrockRateLimiter.execute(() => bedrockClient.send(command));
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    // Parse Mistral's response
    const modelOutput = responseBody.outputs[0].text;
    
    // Log the raw response for debugging
    console.error('Mistral raw response length:', modelOutput.length);
    if (modelOutput.length < 500) {
      console.error('Mistral raw response:', modelOutput);
    }
    
    // Try to extract JSON from response
    let result: BatchSentimentResult | null = null;
    
    // Try direct parse first
    try {
      result = JSON.parse(modelOutput) as BatchSentimentResult;
    } catch (e) {
      // Try regex extraction
      const jsonMatch = modelOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]) as BatchSentimentResult;
        } catch (e2) {
          console.error('Failed to parse Mistral JSON:', e2);
        }
      }
    }
    
    if (result && result.results) {
      // Add model info
      result.summary = {
        ...result.summary,
        _model: 'mistral-large'
      } as any;
      
      // Cache the successful result
      sentimentCache.set(cacheKey, result, 600); // 10 minutes
      
      return result;
    } else {
      console.error('Failed to extract valid JSON from Mistral response');
      throw new Error('Failed to parse JSON from Mistral batch output');
    }
  } catch (error: any) {
    console.error('Mistral batch sentiment analysis error:', error.message);
    
    // Final fallback
    return {
      results: texts.map((text, index) => ({
        index,
        sentiment: 'neutral' as const,
        score: 0.5,
        confidence: 0.5,
        _error: 'All models failed'
      })),
      summary: {
        overall_sentiment: 'unknown',
        key_themes: [],
        business_implications: 'Analysis unavailable - all models failed'
      }
    };
  }
}

// Smart batch analysis that rotates between models
export async function analyzeBatchSmart(texts: string[]): Promise<BatchSentimentResult> {
  // Get the next available model
  const nextModel = sentimentModelRotator.getNextModel();
  console.error(`Using model: ${nextModel}`);
  
  let result: BatchSentimentResult;
  let success = false;
  
  try {
    if (nextModel.includes('claude')) {
      result = await analyzeBatchWithClaude(texts, false); // Don't use Mistral fallback, we'll handle it
      success = true;
    } else {
      result = await analyzeBatchWithMistral(texts);
      success = true;
    }
  } catch (error: any) {
    console.error(`Model ${nextModel} failed:`, error.message);
    
    // Try the other model
    const fallbackModel = nextModel.includes('claude') 
      ? 'mistral.mistral-large-2402-v1:0' 
      : 'anthropic.claude-3-5-sonnet-20240620-v1:0';
    
    console.error(`Trying fallback model: ${fallbackModel}`);
    
    try {
      if (fallbackModel.includes('claude')) {
        result = await analyzeBatchWithClaude(texts, false);
        success = true;
      } else {
        result = await analyzeBatchWithMistral(texts);
        success = true;
      }
    } catch (fallbackError) {
      console.error(`Fallback model also failed:`, fallbackError);
      // Return error result
      result = {
        results: texts.map((text, index) => ({
          index,
          sentiment: 'neutral' as const,
          score: 0.5,
          confidence: 0.5,
          _error: 'All models failed'
        })),
        summary: {
          overall_sentiment: 'unknown',
          key_themes: [],
          business_implications: 'Analysis unavailable - all models failed'
        }
      };
    }
  }
  
  // Record the request result
  sentimentModelRotator.recordRequest(nextModel, success);
  
  // Log model stats periodically
  if (Math.random() < 0.1) { // 10% chance
    console.error('Model rotation stats:', sentimentModelRotator.getStats());
  }
  
  return result;
}

// Optimal batch size based on token limits
export function getOptimalBatchSize(texts: string[]): number {
  const avgTextLength = texts.reduce((sum, t) => sum + t.length, 0) / texts.length;
  
  // Rough estimate: ~4 chars per token, Claude has ~100k token context
  // We want to stay well under limits, so target ~10k tokens per batch
  const targetTokens = 10000;
  const tokensPerText = Math.ceil(avgTextLength / 4);
  const optimalSize = Math.floor(targetTokens / tokensPerText);
  
  // Clamp between 5 and 10 texts per batch (smaller to avoid truncation)
  return Math.max(5, Math.min(10, optimalSize));
}
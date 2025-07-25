import 'dotenv/config';
import { twitterSearchTool } from './src/tools/twitter.js';
import { sentimentAnalysisTool } from './src/tools/sentiment.js';
import { startupAnalysisTool } from './src/tools/startup-analysis.js';
import { dashboardSummaryTool } from './src/tools/dashboard.js';

async function testTools() {
  console.log('🧪 Testing Social Media MCP Tools\n');

  // Test 1: Sentiment Analysis
  console.log('1. Testing Sentiment Analysis...');
  try {
    const sentimentResult = await sentimentAnalysisTool.handler({
      texts: [
        "OpenAI's GPT-4 is incredible! Changed my workflow completely.",
        "The pricing is too high for small startups though.",
        "Overall, it's a game-changer for AI applications."
      ],
      deepAnalysis: true
    });
    console.log('✅ Sentiment Result:', sentimentResult.substring(0, 200) + '...\n');
  } catch (error) {
    console.log('❌ Sentiment Error:', error.message, '\n');
  }

  // Test 2: Twitter Search with Smart Matching
  console.log('2. Testing Twitter Search with Smart Matching...');
  try {
    const twitterResult = await twitterSearchTool.handler({
      query: 'Anthropic',
      limit: 5,
      smartMatch: true,
      website: 'anthropic.com'
    });
    console.log('✅ Twitter Result:', twitterResult.substring(0, 200) + '...\n');
  } catch (error) {
    console.log('❌ Twitter Error:', error.message);
    console.log('   (This is normal if TWITTER_BEARER_TOKEN is not set)\n');
  }

  // Test 3: Comprehensive Startup Analysis
  console.log('3. Testing Startup Analysis...');
  console.log('   This will attempt to gather data from all sources.');
  console.log('   Sources without API keys will show errors.\n');
  
  try {
    const startupResult = await startupAnalysisTool.handler({
      startup_name: 'OpenAI',
      website: 'https://openai.com',
      social_accounts: {
        twitter: 'openai',
        linkedin: 'company/openai'
      },
      keywords: ['ChatGPT', 'GPT-4', 'DALL-E']
    });
    console.log('✅ Startup Analysis Result:');
    console.log(startupResult.substring(0, 500) + '...\n');
  } catch (error) {
    console.log('❌ Startup Analysis Error:', error.message, '\n');
  }

  // Test 4: Dashboard Summary
  console.log('4. Testing Dashboard Summary...');
  try {
    const dashboardResult = await dashboardSummaryTool.handler({
      startup_name: 'OpenAI',
      time_range: '7d'
    });
    console.log('✅ Dashboard Result:', dashboardResult.substring(0, 300) + '...\n');
  } catch (error) {
    console.log('❌ Dashboard Error:', error.message, '\n');
  }

  console.log('🎉 Test Complete!');
  console.log('\nNote: Tools without API keys will show error messages.');
  console.log('This is expected behavior - the tools handle errors gracefully.');
}

// Run tests
testTools().catch(console.error);
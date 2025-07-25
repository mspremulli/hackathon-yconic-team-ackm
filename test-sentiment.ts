import 'dotenv/config';
import { sentimentAnalysisTool } from './src/tools/sentiment.js';

async function testSentiment() {
  console.log('🧪 Testing Claude Sentiment Analysis\n');

  try {
    console.log('Testing with simple texts...');
    const result = await sentimentAnalysisTool.handler({
      texts: [
        "This product is amazing!",
        "Terrible experience, would not recommend.",
        "It's okay, nothing special."
      ],
      deepAnalysis: false
    });
    
    console.log('✅ Result:', result);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testSentiment().catch(console.error);
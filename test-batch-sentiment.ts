import 'dotenv/config';
import { sentimentAnalysisTool } from './src/tools/sentiment.js';

async function testBatchSentiment() {
  console.log('🧪 Testing Batch Sentiment Analysis\n');

  try {
    console.log('Testing with 10 texts...');
    const texts = [
      "This product is absolutely amazing! Best purchase ever.",
      "Terrible experience, would not recommend to anyone.",
      "It's okay, nothing special but does the job.",
      "Revolutionary technology that changes everything!",
      "Complete waste of money, doesn't work as advertised.",
      "Decent quality for the price point.",
      "Exceeded all my expectations, truly impressed.",
      "Mediocre at best, many better alternatives available.",
      "Good customer service but product needs improvement.",
      "Innovative solution to a common problem!"
    ];
    
    const start = Date.now();
    const result = await sentimentAnalysisTool.handler({
      texts,
      deepAnalysis: false
    });
    const elapsed = Date.now() - start;
    
    console.log('✅ Completed in', Math.round(elapsed/1000), 'seconds');
    console.log('\nResult preview:');
    console.log(result.substring(0, 500) + '...\n');
    
    // Extract some stats
    const lines = result.split('\n');
    for (const line of lines) {
      if (line.includes('Overall Sentiment:') || 
          line.includes('Analyzed') ||
          line.includes('Distribution:')) {
        console.log(line.trim());
      }
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testBatchSentiment().catch(console.error);
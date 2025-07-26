#!/usr/bin/env tsx

import { sensoSummaryTool } from './src/tools/senso.js';
import { queryMongoDB } from './src/services/mongodb.js';

async function testSenso() {
  console.log('🧪 Testing Senso.ai Integration...\n');
  
  try {
    // First check if we have any analyses
    console.log('1️⃣ Checking for existing analyses...');
    const analyses = await queryMongoDB('startup_analyses', {}, { limit: 5 });
    console.log(`Found ${analyses.length} analyses in MongoDB\n`);
    
    if (analyses.length === 0) {
      console.log('❌ No startup analyses found. Please run analyze_startup first.');
      return;
    }
    
    // Pick the first startup
    const startup = analyses[0];
    console.log(`2️⃣ Generating Senso summary for: ${startup.startup_name || startup.startupName}`);
    
    // Generate summary
    const result = await sensoSummaryTool.handler({
      startup_name: startup.startup_name || startup.startupName,
      summary_type: 'executive'
    });
    
    console.log('\n3️⃣ Summary Result:');
    console.log(result);
    
    // Check if collection was created
    console.log('\n4️⃣ Checking senso_summaries collection...');
    const summaries = await queryMongoDB('senso_summaries', {}, { limit: 1 });
    console.log(`Found ${summaries.length} summaries in senso_summaries collection`);
    
    if (summaries.length > 0) {
      console.log('\n✅ Senso.ai integration is working!');
      console.log('Summary saved with ID:', summaries[0]._id);
    }
    
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('\nPossible issues:');
    console.error('1. No SENSO_API_KEY in .env file');
    console.error('2. No startup analyses to summarize');
    console.error('3. MongoDB connection issues');
  }
}

// Handler already imported above

async function testDirectly() {
  console.log('\n5️⃣ Testing tool directly...');
  
  try {
    const result = await sensoSummaryTool.handler({
      startup_name: 'OpenAI',
      summary_type: 'executive'
    });
    
    console.log('Direct test result:', result.substring(0, 200) + '...');
  } catch (error: any) {
    console.error('Direct test error:', error.message);
  }
}

testSenso().then(() => testDirectly());
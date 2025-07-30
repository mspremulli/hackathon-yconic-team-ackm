import { getTemporalClient, startStartupAnalysis } from './src/temporal/client.js';

async function testTemporal() {
  console.log('🧪 Testing Temporal integration...\n');
  
  try {
    // Test connection
    console.log('1️⃣ Testing Temporal connection...');
    const client = await getTemporalClient();
    console.log('✅ Connected to Temporal server\n');
    
    // Start a test workflow
    console.log('2️⃣ Starting test workflow...');
    const { workflowId, runId } = await startStartupAnalysis({
      startupName: 'TestStartup',
      website: 'https://example.com',
    });
    
    console.log(`✅ Workflow started!`);
    console.log(`   Workflow ID: ${workflowId}`);
    console.log(`   Run ID: ${runId}\n`);
    
    console.log('🎉 Temporal integration is working!\n');
    console.log('Next steps:');
    console.log('1. Make sure Temporal server is running: docker-compose -f docker-compose.temporal.yml up -d');
    console.log('2. Start the worker: npm run worker:dev');
    console.log('3. View workflows at: http://localhost:8080');
    
  } catch (error: any) {
    console.error('❌ Temporal test failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. Temporal server is running (docker-compose -f docker-compose.temporal.yml up -d)');
    console.error('2. Or use: temporal server start-dev');
    console.error('3. Check TEMPORAL_HOST environment variable (default: localhost:7233)');
  }
}

testTemporal();
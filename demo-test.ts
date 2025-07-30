#!/usr/bin/env tsx

import { startStartupAnalysis, getWorkflowStatus, getWorkflowResult } from './src/temporal/client.js';

async function runDemo() {
  console.log('🎬 Starting AWS Hackathon Demo...\n');
  
  const startupName = process.argv[2] || 'OpenAI';
  console.log(`📊 Analyzing startup: ${startupName}\n`);
  
  try {
    // Start the Temporal workflow
    console.log('1️⃣ Starting Temporal Workflow...');
    const { workflowId, runId } = await startStartupAnalysis({
      startupName,
      website: 'https://openai.com',
    });
    
    console.log(`✅ Workflow started successfully!`);
    console.log(`   Workflow ID: ${workflowId}`);
    console.log(`   Run ID: ${runId}`);
    console.log(`\n📺 View in Temporal UI: http://localhost:8233/namespaces/default/workflows/${workflowId}\n`);
    
    // Poll for status
    console.log('2️⃣ Monitoring workflow progress...');
    let isRunning = true;
    let lastStatus = '';
    
    while (isRunning) {
      const status = await getWorkflowStatus(workflowId);
      
      if (status.status !== lastStatus) {
        console.log(`   Status: ${status.status} (${status.historyLength} events)`);
        lastStatus = status.status;
      }
      
      isRunning = status.isRunning;
      
      if (isRunning) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('\n3️⃣ Workflow completed! Fetching results...\n');
    
    // Get the results
    const results = await getWorkflowResult(workflowId);
    console.log(results.summary);
    
    console.log('\n🎉 Demo completed successfully!');
    console.log('\n💡 Try these commands in your MCP client:');
    console.log(`   - check_temporal_workflow workflow_id="${workflowId}"`);
    console.log(`   - senso_summary startup_name="${startupName}"`);
    console.log(`   - get_senso_summaries startup_name="${startupName}"`);
    
  } catch (error: any) {
    console.error('❌ Demo failed:', error.message);
    console.error('\nMake sure:');
    console.error('1. Temporal is running: temporal server start-dev');
    console.error('2. Worker is running: npm run worker:dev');
    console.error('3. MongoDB is accessible');
  }
}

// Run the demo
console.log('🚀 AWS Hackathon - Startup Intelligence Platform Demo\n');
runDemo();
import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities.js';
import { URL } from 'url';
import path from 'path';

async function run() {
  // Connect to Temporal server
  const temporalHost = process.env.TEMPORAL_HOST || 'localhost:7233';
  const connection = await NativeConnection.connect({
    address: temporalHost,
  });

  // Create a Worker
  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: 'startup-analysis-queue',
    
    // Path to compiled workflow code
    workflowsPath: path.join(process.cwd(), 'dist/temporal/workflows.js'),
    
    // Activities
    activities,
    
    // Worker options
    maxConcurrentActivityTaskExecutions: 10,
    maxConcurrentWorkflowTaskExecutions: 10,
  });

  console.log('🚀 Temporal worker started');
  console.log(`📋 Task Queue: startup-analysis-queue`);
  console.log(`🌐 Connected to: ${temporalHost}`);
  
  // Start the worker
  await worker.run();
}

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n⏹️  Shutting down Temporal worker...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  Shutting down Temporal worker...');
  process.exit(0);
});

// Run the worker
run().catch((err) => {
  console.error('❌ Worker failed to start:', err);
  process.exit(1);
});
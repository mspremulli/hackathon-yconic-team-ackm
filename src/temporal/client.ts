import { Client, Connection } from '@temporalio/client';
import { startupAnalysisWorkflow, startupMonitoringWorkflow } from './workflows.js';
import type { StartupAnalysisInput, StartupAnalysisResult } from './types.js';

let temporalClient: Client | null = null;

export async function getTemporalClient(): Promise<Client> {
  if (temporalClient) {
    return temporalClient;
  }
  
  const temporalHost = process.env.TEMPORAL_HOST || 'localhost:7233';
  
  try {
    const connection = await Connection.connect({
      address: temporalHost,
    });
    
    temporalClient = new Client({
      connection,
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    });
    
    console.error('✅ Connected to Temporal server:', temporalHost);
    return temporalClient;
  } catch (error) {
    console.error('❌ Failed to connect to Temporal:', error);
    throw new Error(`Temporal connection failed: ${error}`);
  }
}

export async function startStartupAnalysis(
  input: StartupAnalysisInput
): Promise<{ workflowId: string; runId: string }> {
  const client = await getTemporalClient();
  
  const workflowId = `startup-analysis-${input.startupName.replace(/\s+/g, '-')}-${Date.now()}`;
  
  const handle = await client.workflow.start(startupAnalysisWorkflow, {
    taskQueue: 'startup-analysis-queue',
    workflowId,
    args: [input],
  });
  
  console.error(`🚀 Started workflow: ${workflowId}`);
  
  return {
    workflowId: handle.workflowId,
    runId: handle.firstExecutionRunId,
  };
}

export async function getWorkflowResult(
  workflowId: string
): Promise<StartupAnalysisResult> {
  const client = await getTemporalClient();
  
  const handle = client.workflow.getHandle(workflowId);
  const result = await handle.result();
  
  return result;
}

export async function getWorkflowStatus(
  workflowId: string
): Promise<{
  status: string;
  historyLength: number;
  isRunning: boolean;
}> {
  const client = await getTemporalClient();
  
  try {
    const handle = client.workflow.getHandle(workflowId);
    const description = await handle.describe();
    
    return {
      status: description.status.name,
      historyLength: description.historyLength,
      isRunning: description.status.name === 'RUNNING',
    };
  } catch (error) {
    console.error('Failed to get workflow status:', error);
    throw error;
  }
}

export async function startStartupMonitoring(
  startupName: string,
  interval: string = '1h',
  duration: string = '24h'
): Promise<{ workflowId: string; runId: string }> {
  const client = await getTemporalClient();
  
  const workflowId = `startup-monitoring-${startupName.replace(/\s+/g, '-')}-${Date.now()}`;
  
  const handle = await client.workflow.start(startupMonitoringWorkflow, {
    taskQueue: 'startup-analysis-queue',
    workflowId,
    args: [{
      startupName,
      interval,
      duration,
    }],
  });
  
  console.error(`🔄 Started monitoring workflow: ${workflowId}`);
  console.error(`📊 Will analyze every ${interval} for ${duration}`);
  
  return {
    workflowId: handle.workflowId,
    runId: handle.firstExecutionRunId,
  };
}

export async function cancelWorkflow(workflowId: string): Promise<void> {
  const client = await getTemporalClient();
  
  const handle = client.workflow.getHandle(workflowId);
  await handle.cancel();
  
  console.error(`❌ Cancelled workflow: ${workflowId}`);
}
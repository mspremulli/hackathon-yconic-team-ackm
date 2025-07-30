import { z } from 'zod';
import { Tool } from '../types/index.js';
import { 
  startStartupAnalysis, 
  getWorkflowResult, 
  getWorkflowStatus,
  startStartupMonitoring,
  cancelWorkflow
} from '../temporal/client.js';

const TemporalStartupAnalysisSchema = z.object({
  startup_name: z.string().describe('Name of the startup to analyze'),
  website: z.string().optional().describe('Company website URL'),
  social_accounts: z.object({
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    bluesky: z.string().optional(),
    youtube: z.string().optional(),
  }).optional().describe('Official company social media accounts'),
  founders: z.array(z.object({
    name: z.string(),
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    bluesky: z.string().optional(),
  })).optional().describe('List of founders with their social handles'),
  keywords: z.array(z.string()).optional().describe('Additional keywords to search for'),
  competitors: z.array(z.string()).optional().describe('List of competitor names'),
  wait_for_result: z.boolean().optional().default(false).describe('Wait for the workflow to complete and return results'),
});

async function temporalAnalyzeStartup(params: z.infer<typeof TemporalStartupAnalysisSchema>): Promise<string> {
  const { 
    startup_name, 
    website, 
    social_accounts, 
    founders, 
    keywords, 
    competitors,
    wait_for_result 
  } = params;
  
  try {
    // Start the Temporal workflow
    const { workflowId, runId } = await startStartupAnalysis({
      startupName: startup_name,
      website,
      socialAccounts: social_accounts,
      founders,
      keywords,
      competitors,
    });
    
    let result = `# Temporal Startup Analysis Started\n\n`;
    result += `Startup: ${startup_name}\n`;
    result += `Workflow ID: ${workflowId}\n`;
    result += `Run ID: ${runId}\n\n`;
    
    if (wait_for_result) {
      result += `⏳ Waiting for analysis to complete...\n\n`;
      
      // Poll for status
      let isRunning = true;
      while (isRunning) {
        const status = await getWorkflowStatus(workflowId);
        isRunning = status.isRunning;
        
        if (isRunning) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        }
      }
      
      // Get the final result
      const analysisResult = await getWorkflowResult(workflowId);
      result += analysisResult.summary;
    } else {
      result += `## Workflow Status\n`;
      result += `The analysis is running in the background. You can check its status using:\n`;
      result += `- Workflow ID: ${workflowId}\n`;
      result += `- Use the 'check_temporal_workflow' tool to monitor progress\n\n`;
      
      result += `## Benefits of Temporal\n`;
      result += `- **Durability**: The analysis will continue even if the system restarts\n`;
      result += `- **Retries**: Failed API calls will be automatically retried\n`;
      result += `- **Visibility**: Full audit trail of all activities\n`;
      result += `- **Scalability**: Can handle thousands of concurrent analyses\n`;
    }
    
    return result;
  } catch (error: any) {
    return `Error starting Temporal workflow: ${error.message}\n\nMake sure Temporal server is running locally or configure TEMPORAL_HOST environment variable.`;
  }
}

export const temporalStartupAnalysisTool: Tool = {
  name: 'analyze_startup_temporal',
  description: 'Run startup analysis using Temporal workflows for durability and fault tolerance',
  inputSchema: TemporalStartupAnalysisSchema,
  handler: temporalAnalyzeStartup,
};

// Tool to check workflow status
const CheckWorkflowSchema = z.object({
  workflow_id: z.string().describe('The workflow ID to check'),
});

async function checkWorkflow(params: z.infer<typeof CheckWorkflowSchema>): Promise<string> {
  const { workflow_id } = params;
  
  try {
    const status = await getWorkflowStatus(workflow_id);
    
    let result = `# Workflow Status\n\n`;
    result += `Workflow ID: ${workflow_id}\n`;
    result += `Status: ${status.status}\n`;
    result += `History Length: ${status.historyLength} events\n`;
    result += `Is Running: ${status.isRunning ? 'Yes' : 'No'}\n`;
    
    if (!status.isRunning) {
      result += `\n## Get Results\n`;
      result += `The workflow has completed. Use 'get_temporal_workflow_result' to retrieve the results.\n`;
    }
    
    return result;
  } catch (error: any) {
    return `Error checking workflow: ${error.message}`;
  }
}

export const checkTemporalWorkflowTool: Tool = {
  name: 'check_temporal_workflow',
  description: 'Check the status of a Temporal workflow',
  inputSchema: CheckWorkflowSchema,
  handler: checkWorkflow,
};

// Tool to get workflow results
const GetWorkflowResultSchema = z.object({
  workflow_id: z.string().describe('The workflow ID to get results for'),
});

async function getResult(params: z.infer<typeof GetWorkflowResultSchema>): Promise<string> {
  const { workflow_id } = params;
  
  try {
    const result = await getWorkflowResult(workflow_id);
    return result.summary;
  } catch (error: any) {
    return `Error getting workflow result: ${error.message}`;
  }
}

export const getTemporalWorkflowResultTool: Tool = {
  name: 'get_temporal_workflow_result',
  description: 'Get the results of a completed Temporal workflow',
  inputSchema: GetWorkflowResultSchema,
  handler: getResult,
};

// Tool to start monitoring
const StartMonitoringSchema = z.object({
  startup_name: z.string().describe('Name of the startup to monitor'),
  interval: z.string().optional().default('1h').describe('Analysis interval (e.g., 30m, 1h, 6h, 1d)'),
  duration: z.string().optional().default('24h').describe('Total monitoring duration (e.g., 24h, 7d)'),
});

async function startMonitoring(params: z.infer<typeof StartMonitoringSchema>): Promise<string> {
  const { startup_name, interval, duration } = params;
  
  try {
    const { workflowId, runId } = await startStartupMonitoring(
      startup_name,
      interval,
      duration
    );
    
    let result = `# Startup Monitoring Started\n\n`;
    result += `Startup: ${startup_name}\n`;
    result += `Workflow ID: ${workflowId}\n`;
    result += `Run ID: ${runId}\n`;
    result += `Interval: ${interval}\n`;
    result += `Duration: ${duration}\n\n`;
    
    result += `## What's Happening\n`;
    result += `The monitoring workflow will:\n`;
    result += `1. Run a full analysis of ${startup_name} immediately\n`;
    result += `2. Repeat the analysis every ${interval}\n`;
    result += `3. Continue for ${duration} total\n`;
    result += `4. Save all results to MongoDB for trend analysis\n\n`;
    
    result += `Use 'check_temporal_workflow' with the workflow ID to monitor progress.`;
    
    return result;
  } catch (error: any) {
    return `Error starting monitoring: ${error.message}`;
  }
}

export const startTemporalMonitoringTool: Tool = {
  name: 'monitor_startup_temporal',
  description: 'Start continuous monitoring of a startup using Temporal',
  inputSchema: StartMonitoringSchema,
  handler: startMonitoring,
};

// Tool to cancel workflow
const CancelWorkflowSchema = z.object({
  workflow_id: z.string().describe('The workflow ID to cancel'),
});

async function cancelWorkflowHandler(params: z.infer<typeof CancelWorkflowSchema>): Promise<string> {
  const { workflow_id } = params;
  
  try {
    await cancelWorkflow(workflow_id);
    return `Successfully cancelled workflow: ${workflow_id}`;
  } catch (error: any) {
    return `Error cancelling workflow: ${error.message}`;
  }
}

export const cancelTemporalWorkflowTool: Tool = {
  name: 'cancel_temporal_workflow',
  description: 'Cancel a running Temporal workflow',
  inputSchema: CancelWorkflowSchema,
  handler: cancelWorkflowHandler,
};
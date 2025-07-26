# Temporal Integration for Startup Analysis

This project now includes Temporal workflow orchestration for durable, fault-tolerant startup analysis.

## What is Temporal?

Temporal is a workflow orchestration platform that makes distributed applications resilient by default. It handles:
- **Durability**: Workflows continue running even if workers crash
- **Retries**: Automatic retry with exponential backoff
- **Visibility**: Complete audit trail of all workflow executions
- **Scalability**: Distribute work across multiple workers

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│   MCP Client    │────▶│   MCP Server     │────▶│ Temporal Client│
└─────────────────┘     └──────────────────┘     └────────┬───────┘
                                                           │
                                                           ▼
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│ Temporal Worker │◀────│ Temporal Server  │◀────│   Workflows    │
└─────────────────┘     └──────────────────┘     └────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Activities                              │
├─────────────┬─────────────┬─────────────┬─────────────────────┤
│   Twitter   │   Reddit    │   Tavily    │   Sentiment Analysis │
│   Bluesky   │   YouTube   │   News      │   MongoDB Save       │
└─────────────┴─────────────┴─────────────┴─────────────────────┘
```

## Quick Start

### 1. Start Temporal Server

Using Docker Compose:
```bash
docker-compose -f docker-compose.temporal.yml up -d
```

Or using Temporal CLI:
```bash
temporal server start-dev
```

### 2. Build the Project

```bash
npm run build
```

### 3. Start the Temporal Worker

```bash
./start-temporal-worker.sh
```

### 4. Use Temporal Tools in MCP

The MCP server now includes these Temporal tools:

- `analyze_startup_temporal` - Run durable startup analysis
- `monitor_startup_temporal` - Start continuous monitoring
- `check_temporal_workflow` - Check workflow status
- `get_temporal_workflow_result` - Get workflow results
- `cancel_temporal_workflow` - Cancel running workflow

## Example Usage

### One-time Analysis
```
analyze_startup_temporal startup_name="OpenAI" wait_for_result=true
```

### Continuous Monitoring
```
monitor_startup_temporal startup_name="Anthropic" interval="1h" duration="24h"
```

### Check Status
```
check_temporal_workflow workflow_id="startup-analysis-OpenAI-1234567890"
```

## Benefits Over Direct Execution

1. **Resilience**: If the worker crashes, the workflow resumes from where it left off
2. **Rate Limiting**: Built-in retry with exponential backoff prevents API rate limit issues
3. **Parallelism**: Activities run in parallel while respecting rate limits
4. **Monitoring**: Use Temporal UI at http://localhost:8080 to monitor workflows
5. **History**: Complete audit trail of all executions

## Temporal UI

Access the Temporal Web UI at: http://localhost:8080

Features:
- View running and completed workflows
- Inspect workflow history
- See activity failures and retries
- Monitor worker health

## Configuration

Environment variables:
- `TEMPORAL_HOST`: Temporal server address (default: localhost:7233)
- `TEMPORAL_NAMESPACE`: Namespace to use (default: default)

## Troubleshooting

### Worker Won't Start
- Ensure Temporal server is running: `nc -z localhost 7233`
- Check TypeScript compilation: `npm run build`

### Workflows Stuck
- Check Temporal UI for errors
- Ensure worker is running: `ps aux | grep worker`
- Check worker logs for activity errors

### Rate Limiting
- Temporal automatically retries with exponential backoff
- Configure retry policy in workflows.ts

## Development

### Adding New Activities

1. Add activity function to `src/temporal/activities.ts`
2. Add activity proxy to `src/temporal/workflows.ts`
3. Rebuild: `npm run build`
4. Restart worker

### Modifying Workflows

1. Update workflow in `src/temporal/workflows.ts`
2. Version appropriately for running workflows
3. Rebuild and restart worker

## Monitoring Best Practices

1. Use structured logging in activities
2. Emit heartbeats for long-running activities
3. Set appropriate timeouts
4. Monitor worker metrics

## Production Considerations

1. Use persistent Temporal cluster (not dev mode)
2. Configure proper retention policies
3. Set up monitoring and alerting
4. Use multiple workers for scalability
5. Implement proper error handling
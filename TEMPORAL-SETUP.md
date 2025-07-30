# Temporal Setup Guide

## Option 1: Using Temporal CLI (Recommended for Development)

1. **Install Temporal CLI**:
   ```bash
   curl -sSf https://temporal.download/cli.sh | sh
   export PATH="$PATH:$HOME/.temporalio/bin"
   ```

2. **Start Temporal Dev Server**:
   ```bash
   temporal server start-dev
   ```
   
   This starts:
   - Temporal Server at `localhost:7233`
   - Web UI at `http://localhost:8233`

3. **Start the Worker**:
   ```bash
   npm run worker:dev
   ```

## Option 2: Using Docker (Production-like)

1. **Start Temporal with Docker Compose**:
   ```bash
   docker-compose -f docker-compose.temporal.yml up -d
   ```

2. **Check if running**:
   ```bash
   docker ps | grep temporal
   ```

3. **Start the Worker**:
   ```bash
   npm run worker:dev
   ```

## Option 3: Using Temporal Cloud (Production)

1. **Sign up for Temporal Cloud**: https://temporal.io/cloud

2. **Update environment variables**:
   ```env
   TEMPORAL_HOST=your-namespace.tmprl.cloud:7233
   TEMPORAL_NAMESPACE=your-namespace
   ```

3. **Configure mTLS** (if required)

## Troubleshooting

### Docker Issues on Windows/WSL

If Docker containers exit immediately:
1. Check Docker Desktop is running
2. Ensure WSL2 is properly configured
3. Try running without `-d` to see errors: `docker-compose -f docker-compose.temporal.yml up`

### Connection Refused

If you get "Connection refused" errors:
1. Ensure Temporal is fully started (wait 10-15 seconds)
2. Check the correct port: `nc -zv localhost 7233`
3. Try `127.0.0.1` instead of `localhost`

### Alternative: Mock Mode

To test without Temporal:
1. Set environment variable: `TEMPORAL_MOCK=true`
2. The MCP tools will simulate workflows without actual Temporal

## Verifying Setup

Run the test script:
```bash
npx tsx test-temporal.ts
```

If successful, you'll see:
- ✅ Connected to Temporal server
- ✅ Workflow started!

## Next Steps

1. Access Temporal Web UI:
   - CLI mode: http://localhost:8233
   - Docker mode: http://localhost:8080

2. Use the MCP tools:
   - `analyze_startup_temporal`
   - `monitor_startup_temporal`
   - `check_temporal_workflow`
   - `get_temporal_workflow_result`
   - `cancel_temporal_workflow`

3. Monitor workflows in the UI
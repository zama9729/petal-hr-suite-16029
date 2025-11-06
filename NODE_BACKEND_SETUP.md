# Node.js Backend Configuration for Python RAG Service

## Current Configuration

The Node.js backend is **already configured** to use port 8001 by default:

- `server/services/askHR.js` - Defaults to `http://localhost:8001`
- `server/routes/rag.js` - Defaults to `http://localhost:8001`
- `server/services/ragHybridClient.js` - Defaults to `http://localhost:8001`

## To Ensure Correct Configuration

When starting your Node.js backend, explicitly set the environment variable:

```powershell
# In your Node.js backend terminal:
$env:RAG_API_URL="http://localhost:8001"
$env:DB_HOST="localhost"
$env:DB_PORT="5433"
$env:DB_NAME="hr_suite"
$env:DB_USER="postgres"
$env:DB_PASSWORD="postgres"
$env:JWT_SECRET_KEY="change-me-dev-only"

cd server
npm run dev
```

## Verify It's Working

1. **Check Python RAG service is running:**
   ```powershell
   curl http://localhost:8001/health
   ```
   Should return: `{"status":"healthy","service":"rag-with-tools",...}`

2. **Check Node backend logs:**
   When you make a RAG query, you should see:
   ```
   [RAG] Using Python RAG
   ```

3. **Test in RAG Console:**
   - Make a query
   - Response should show `"source": "python-rag-service-with-tools"` or `"python-rag-service"`
   - If tool calling is used, you'll see `tool_calls` and `tool_results` in the response

## Troubleshooting

### Node backend can't connect to Python RAG
- **Check Python service is running:** `curl http://localhost:8001/health`
- **Check port:** Make sure nothing else is using port 8001
- **Check environment variable:** `echo $env:RAG_API_URL` (should be `http://localhost:8001`)

### Wrong port being used
- **Explicitly set:** `$env:RAG_API_URL="http://localhost:8001"`
- **Restart Node backend** after setting the variable



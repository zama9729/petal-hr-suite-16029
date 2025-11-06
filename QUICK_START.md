# Quick Start Guide - Python RAG Service

## ✅ Status

- **Python RAG Service**: Running on port 8001 ✅
- **Node.js Backend**: Already configured to use port 8001 ✅

## Current Status

The Python RAG service with tool calling is **running**:
```json
{
  "status": "healthy",
  "service": "rag-with-tools",
  "has_openai": false,
  "tools_available": 5
}
```

**Note:** `has_openai: false` means tool calling will be limited. Set `OPENAI_API_KEY` for full functionality.

## Starting Services

### 1. Python RAG Service (Port 8001)

The service is currently running. To restart it:

```powershell
# Activate venv
.\.rag-venv\Scripts\Activate.ps1

# Set environment variables
$env:JWT_SECRET_KEY="change-me-dev-only"
$env:OPENAI_API_KEY="your-openai-key-here"  # Optional but recommended

# Start service (from project root)
python -m uvicorn rag_service.rag_with_tools:app --host 0.0.0.0 --port 8001
```

Or use the startup script:
```powershell
.\start_rag_service.ps1
```

### 2. Node.js Backend

The Node.js backend **already defaults to port 8001**, but you can explicitly set it:

```powershell
# Set environment variables
$env:RAG_API_URL="http://localhost:8001"  # Already the default
$env:DB_HOST="localhost"
$env:DB_PORT="5433"
$env:DB_NAME="hr_suite"
$env:DB_USER="postgres"
$env:DB_PASSWORD="postgres"
$env:JWT_SECRET_KEY="change-me-dev-only"

# Start backend
cd server
npm run dev
```

## Verify Everything is Working

1. **Check Python RAG service:**
   ```powershell
   curl http://localhost:8001/health
   ```
   Should return: `{"status":"healthy",...}`

2. **Test in RAG Console:**
   - Go to RAG Console in the UI
   - Make a query
   - Check response for `"source": "python-rag-service-with-tools"`

3. **Check Node backend logs:**
   - Should see: `[RAG] Using Python RAG`

## Important Notes

- **Node.js backend defaults to port 8001** - no changes needed!
- **Python service is running** - verified via health check
- **For full tool calling**, set `OPENAI_API_KEY` environment variable

## Troubleshooting

### Python service not running
```powershell
# Check if it's running
curl http://localhost:8001/health

# If not, start it:
.\.rag-venv\Scripts\Activate.ps1
$env:JWT_SECRET_KEY="change-me-dev-only"
python -m uvicorn rag_service.rag_with_tools:app --host 0.0.0.0 --port 8001
```

### Node backend can't connect
- Make sure Python service is running: `curl http://localhost:8001/health`
- Verify `RAG_API_URL` is set: `echo $env:RAG_API_URL`
- Restart Node backend after setting environment variables

### Port 8001 already in use
```powershell
# Find process using port 8001
netstat -ano | findstr ":8001"
# Kill it (replace <PID> with actual PID)
taskkill /PID <PID> /F
```

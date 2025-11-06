# Python RAG Service - Complete Setup Guide

## 📋 Prerequisites

1. **Python 3.8+** installed on your system
2. **Project root directory**: `C:\Users\sharvin\Desktop\HR LAST\petal-hr-suite-16029`
3. **OpenAI API Key** (optional but recommended for LLM responses)

---

## 🚀 Quick Start (3 Steps)

### Step 1: Open PowerShell Terminal
Navigate to the project root:
```powershell
cd "C:\Users\sharvin\Desktop\HR LAST\petal-hr-suite-16029"
```

### Step 2: Activate Virtual Environment
```powershell
.\.rag-venv\Scripts\Activate.ps1
```

**If virtual environment doesn't exist**, create it first:
```powershell
python -m venv .rag-venv
.\.rag-venv\Scripts\Activate.ps1
pip install -r rag_service\requirements.txt
```

### Step 3: Set Environment Variables & Start Service
```powershell
$env:JWT_SECRET_KEY="change-me-dev-only"
$env:OPENAI_API_KEY="<your-openai-api-key-here>"
python -m uvicorn rag_service.rag_with_tools:app --host 0.0.0.0 --port 8001
```

**Expected output:**
```
INFO:     Started server process [PID]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
```

---

## ✅ Verify It's Running

### Option A: Health Check (PowerShell)
```powershell
Invoke-RestMethod -Uri http://localhost:8001/health | ConvertTo-Json
```

**Expected response:**
```json
{
  "status": "healthy",
  "service": "rag-with-tools",
  "has_openai": true,
  "tools_available": 5
}
```

### Option B: Health Check (Browser)
Open: `http://localhost:8001/health`

### Option C: Check Logs
The terminal should show the service is running without errors.

---

## 🧪 Test the Service

### 1. Test Query Endpoint (PowerShell)

First, get a JWT token from your Node.js backend (login to the HR app), then:

```powershell
$token = "<your-jwt-token-here>"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}
$body = @{
    query = "What are the working hours?"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:8001/api/v1/query -Method POST -Headers $headers -Body $body | ConvertTo-Json -Depth 10
```

### 2. Test Ingestion (PowerShell)

```powershell
$token = "<your-jwt-token-here>"
$body = @'
{
  "text": "Employees must work from 9 AM to 6 PM with 1-hour lunch break.",
  "doc_id": "work_hours_policy",
  "tenant_id": "tenant_1",
  "allowed_roles": ["employee", "hr", "ceo"]
}
'@

Invoke-RestMethod -Uri http://localhost:8001/api/v1/ingest -Method POST -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } -Body $body | ConvertTo-Json
```

### 3. Test via Frontend
1. Start your Node.js backend (if not already running)
2. Open the HR app in browser
3. Navigate to **RAG Console** in the sidebar
4. Use the **Query** tab to test queries
5. Use the **Ingest** tab to upload documents

---

## 🔧 Alternative: Use Startup Script

Instead of manual steps, use the provided script:

```powershell
.\start_rag_service.ps1
```

This script will:
- ✅ Check/create virtual environment
- ✅ Install dependencies if missing
- ✅ Set environment variables
- ✅ Start the service

---

## 🛠️ Troubleshooting

### Issue: "uvicorn not found"
**Solution:**
```powershell
.\.rag-venv\Scripts\Activate.ps1
pip install -r rag_service\requirements.txt
```

### Issue: "Port 8001 already in use"
**Solution:**
```powershell
# Find the process
netstat -ano | findstr ":8001"

# Kill it (replace <PID> with the actual process ID)
taskkill /PID <PID> /F

# Or kill all Python processes (use with caution)
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
```

### Issue: "Module not found: tools"
**Solution:** Make sure you're running from project root:
```powershell
cd "C:\Users\sharvin\Desktop\HR LAST\petal-hr-suite-16029"
python -m uvicorn rag_service.rag_with_tools:app --host 0.0.0.0 --port 8001
```

### Issue: "JWT_SECRET_KEY not configured"
**Solution:**
```powershell
$env:JWT_SECRET_KEY="change-me-dev-only"
```

### Issue: "No LLM configured" or responses show "No LLM configured"
**Solution:** Set OPENAI_API_KEY:
```powershell
$env:OPENAI_API_KEY="your-openai-api-key-here"
```

### Issue: "Invalid token" or "Not authenticated"
**Solution:**
- Make sure `JWT_SECRET_KEY` in Python service matches the one in Node.js backend
- Verify the JWT token includes `user_id`, `tenant_id`, and `role` claims
- Check token expiration

### Issue: Service starts but queries return "Python RAG service unavailable"
**Solution:**
- Check Node.js backend has `RAG_API_URL=http://localhost:8001` (or `http://host.docker.internal:8001` if using Docker)
- Verify firewall isn't blocking port 8001
- Check Node.js backend logs for connection errors

---

## 📝 Important Notes

1. **Keep the terminal open** - The service runs in the foreground. Closing the terminal stops it.

2. **Environment variables** - They only persist for the current PowerShell session. If you open a new terminal, set them again.

3. **Virtual environment** - Always activate it before starting the service:
   ```powershell
   .\.rag-venv\Scripts\Activate.ps1
   ```

4. **Project root** - Always run from project root when using `rag_service.rag_with_tools:app`:
   ```powershell
   cd "C:\Users\sharvin\Desktop\HR LAST\petal-hr-suite-16029"
   ```

5. **Docker** - If Node.js backend runs in Docker, use `host.docker.internal:8001` instead of `localhost:8001`

---

## 🎯 Complete Workflow Example

```powershell
# 1. Navigate to project
cd "C:\Users\sharvin\Desktop\HR LAST\petal-hr-suite-16029"

# 2. Activate virtual environment
.\.rag-venv\Scripts\Activate.ps1

# 3. Set environment variables
$env:JWT_SECRET_KEY="change-me-dev-only"
$env:OPENAI_API_KEY="<your-openai-api-key-here>"

# 4. Start service
python -m uvicorn rag_service.rag_with_tools:app --host 0.0.0.0 --port 8001

# 5. In another terminal, verify it's running
Invoke-RestMethod -Uri http://localhost:8001/health | ConvertTo-Json
```

---

## 🔍 Available Endpoints

Once running, the service exposes:

- **`GET /health`** - Health check
- **`POST /api/v1/query`** - Query the RAG system
- **`POST /api/v1/ingest`** - Ingest documents
- **`GET /api/v1/ingest/debug`** - List indexed documents
- **`GET /api/v1/audit/logs`** - View audit logs

All endpoints (except `/health`) require JWT authentication via `Authorization: Bearer <token>` header.

---

## ✨ Features

- ✅ **Multi-tenant isolation** - Each tenant's data is completely separated
- ✅ **RBAC enforcement** - Role-based access control for documents and tools
- ✅ **Tool calling** - LLM can execute predefined functions (leave balance, payroll, etc.)
- ✅ **Vector search** - Semantic search using ChromaDB
- ✅ **Audit logging** - All queries and actions are logged
- ✅ **Document ingestion** - Upload and index policy documents

---

## 🆘 Need Help?

If you encounter issues:
1. Check the troubleshooting section above
2. Review service logs in the terminal
3. Verify environment variables are set correctly
4. Ensure virtual environment is activated
5. Check port 8001 is not in use by another service

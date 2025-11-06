# Python RAG Service Setup Complete ✅

## What Was Created

1. **Tools Module** (`rag_service/tools/`)
   - `tools_registry.py` - Tool registry with database query tools
   - `__init__.py` - Module exports

2. **RAG with Tools Service** (`rag_service/rag_with_tools.py`)
   - FastAPI endpoint with tool calling support
   - Integrates with existing RAG system
   - Role-based tool access

3. **Startup Scripts**
   - `start_rag_service.ps1` - Automated startup script
   - `START_PYTHON_RAG.md` - Updated documentation

## How to Start

### Quick Start (Recommended)

Run from project root:
```powershell
.\start_rag_service.ps1
```

This script will:
- ✅ Activate/create virtual environment
- ✅ Install dependencies
- ✅ Set environment variables
- ✅ Start the service on port 8001

### Manual Start

1. **Activate virtual environment:**
   ```powershell
   .\.rag-venv\Scripts\Activate.ps1
   ```

2. **Set environment variables:**
   ```powershell
   $env:JWT_SECRET_KEY="change-me-dev-only"
   $env:OPENAI_API_KEY="your-openai-key-here"  # Required for tool calling
   ```

3. **Start the service:**
   ```powershell
   # From project root:
   python -m uvicorn rag_service.rag_with_tools:app --host 0.0.0.0 --port 8001
   
   # OR from rag_service directory:
   cd rag_service
   python -m uvicorn rag_with_tools:app --host 0.0.0.0 --port 8001
   ```

## Verify It's Running

1. **Health check:**
   ```powershell
   curl http://localhost:8001/health
   ```

2. **Expected response:**
   ```json
   {
     "status": "healthy",
     "service": "rag-with-tools",
     "has_openai": true,
     "tools_available": 5
   }
   ```

3. **Check logs** - Should show:
   ```
   INFO:     Started server process
   INFO:     Application startup complete.
   INFO:     Uvicorn running on http://0.0.0.0:8001
   ```

## Update Node Backend

Make sure your Node.js backend points to the new service:

```powershell
# In Node backend terminal:
$env:RAG_API_URL="http://localhost:8001"
```

Then restart your Node backend.

## Test in RAG Console

1. Go to RAG Console in the UI
2. Make a query like "What is my leave balance?"
3. Check the response - it should include:
   - `"source": "python-rag-service-with-tools"`
   - `tool_calls` array (if tools were used)
   - `tool_results` array (with tool execution results)

## Available Tools

- **Employee Tools:**
  - `get_employee_leave_balance` - Get your leave balance
  - `get_employee_payroll_info` - Get payroll information
  - `submit_leave_request` - Submit a leave request

- **HR/CEO Tools:**
  - `get_department_headcount` - Get department employee count
  - `get_employees_on_leave` - List employees currently on leave

## Troubleshooting

### "ModuleNotFoundError: No module named 'jwt'"
**Solution:** Activate virtual environment and install dependencies:
```powershell
.\.rag-venv\Scripts\Activate.ps1
pip install -r rag_service/requirements.txt
```

### "Port 8001 already in use"
**Solution:** Kill the existing process:
```powershell
netstat -ano | findstr ":8001"
taskkill /PID <PID> /F
```

### "No LLM configured"
**Solution:** Set OPENAI_API_KEY:
```powershell
$env:OPENAI_API_KEY="your-key-here"
```

### "ImportError: cannot import name 'ToolRegistry'"
**Solution:** Make sure you're running from project root:
```powershell
cd C:\Users\sharvin\Desktop\HR LAST\petal-hr-suite-16029
python -m uvicorn rag_service.rag_with_tools:app --host 0.0.0.0 --port 8001
```

## Next Steps

1. ✅ Start the Python RAG service
2. ✅ Update Node backend `RAG_API_URL` to `http://localhost:8001`
3. ✅ Test queries in RAG Console
4. ✅ Verify tool calling works with queries like "What is my leave balance?"

## Files Created

- `rag_service/tools/__init__.py`
- `rag_service/tools/tools_registry.py`
- `rag_service/rag_with_tools.py`
- `start_rag_service.ps1`
- `START_PYTHON_RAG.md` (updated)
- `RAG_SETUP_COMPLETE.md` (this file)

All set! 🚀



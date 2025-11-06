# PowerShell script to start RAG service with tool calling
# Run from project root: .\rag_service\start_rag_with_tools.ps1

Write-Host "Starting Python RAG Service with Tool Calling..." -ForegroundColor Green

# Activate virtual environment if it exists
if (Test-Path "..\.rag-venv\Scripts\Activate.ps1") {
    Write-Host "Activating virtual environment..." -ForegroundColor Yellow
    & "..\.rag-venv\Scripts\Activate.ps1"
}

# Set environment variables
$env:JWT_SECRET_KEY = "change-me-dev-only"
if (-not $env:OPENAI_API_KEY) {
    Write-Host "Warning: OPENAI_API_KEY not set. Tool calling will be limited." -ForegroundColor Yellow
    Write-Host "Set it with: `$env:OPENAI_API_KEY='your-key-here'" -ForegroundColor Yellow
}

# Start the service
Write-Host "Starting service on port 8001..." -ForegroundColor Cyan
python -m uvicorn rag_with_tools:app --host 0.0.0.0 --port 8001



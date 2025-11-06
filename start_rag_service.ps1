# Start Python RAG Service with Tool Calling
# Run from project root

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Python RAG Service with Tools" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if virtual environment exists
$venvPath = ".\.rag-venv\Scripts\Activate.ps1"
if (Test-Path $venvPath) {
    Write-Host "[1/4] Activating virtual environment..." -ForegroundColor Yellow
    & $venvPath
} else {
    Write-Host "[1/4] Creating virtual environment..." -ForegroundColor Yellow
    python -m venv .rag-venv
    & $venvPath
}

# Check and install dependencies
Write-Host "[2/4] Checking dependencies..." -ForegroundColor Yellow
$missingDeps = $false
try {
    python -c "import fastapi; import uvicorn; import jwt; import chromadb" 2>$null
    if ($LASTEXITCODE -ne 0) { $missingDeps = $true }
} catch {
    $missingDeps = $true
}

if ($missingDeps) {
    Write-Host "[2/4] Installing dependencies..." -ForegroundColor Yellow
    pip install -r rag_service\requirements.txt
}

# Set environment variables
Write-Host "[3/4] Setting environment variables..." -ForegroundColor Yellow
$env:JWT_SECRET_KEY = "change-me-dev-only"

if (-not $env:OPENAI_API_KEY) {
    Write-Host "Warning: OPENAI_API_KEY not set. Tool calling will be limited." -ForegroundColor Red
    Write-Host "Set it with: `$env:OPENAI_API_KEY='your-key-here'" -ForegroundColor Yellow
    Write-Host ""
}

# Start the service
Write-Host "[4/4] Starting RAG service on port 8001..." -ForegroundColor Green
Write-Host ""
Write-Host "Service will be available at: http://localhost:8001" -ForegroundColor Cyan
Write-Host "Health check: http://localhost:8001/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the service" -ForegroundColor Yellow
Write-Host ""

# Change to rag_service directory and start
cd rag_service
python -m uvicorn rag_with_tools:app --host 0.0.0.0 --port 8001



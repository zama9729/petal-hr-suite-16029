# Test RAG Ingestion and Query Script
# This script helps diagnose and fix policy ingestion issues

param(
    [string]$Token = "",
    [string]$TenantId = "tenant_1"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "RAG Ingestion & Query Test Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if Python RAG service is running
Write-Host "[1/6] Checking Python RAG service..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8001/health" -ErrorAction Stop
    Write-Host "✅ Service is running" -ForegroundColor Green
    Write-Host "   Status: $($health.status)" -ForegroundColor Gray
    Write-Host "   Vector DB: $($health.vector_db)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Python RAG service is not running!" -ForegroundColor Red
    Write-Host "   Start it with: .\.rag-venv\Scripts\Activate.ps1; python -m uvicorn rag_service.rag_with_tools:app --host 0.0.0.0 --port 8001" -ForegroundColor Yellow
    exit 1
}

# Step 2: Get JWT Token
Write-Host ""
Write-Host "[2/6] Getting JWT token..." -ForegroundColor Yellow
if (-not $Token) {
    Write-Host "⚠️  No token provided. Please provide a valid JWT token." -ForegroundColor Yellow
    Write-Host "   Get it from:" -ForegroundColor Gray
    Write-Host "   - Node.js backend logs after login" -ForegroundColor Gray
    Write-Host "   - Browser DevTools → Local Storage" -ForegroundColor Gray
    Write-Host "   - Or use: `$token = '<your-token>'" -ForegroundColor Gray
    $Token = Read-Host "Enter JWT token"
}

if (-not $Token) {
    Write-Host "❌ Token is required!" -ForegroundColor Red
    exit 1
}

# Decode JWT to verify (basic check)
$tokenParts = $Token.Split('.')
if ($tokenParts.Count -ne 3) {
    Write-Host "⚠️  Token format looks invalid (should have 3 parts separated by '.')" -ForegroundColor Yellow
} else {
    Write-Host "✅ Token format looks valid" -ForegroundColor Green
}

# Step 3: Test debug endpoint to see existing documents
Write-Host ""
Write-Host "[3/6] Checking existing documents for tenant '$TenantId'..." -ForegroundColor Yellow
try {
    $debugResponse = Invoke-RestMethod `
        -Uri "http://localhost:8001/api/v1/ingest/debug" `
        -Headers @{
            "Authorization" = "Bearer $Token"
        } -ErrorAction Stop
    
    Write-Host "✅ Found $($debugResponse.count) document(s) for this tenant" -ForegroundColor Green
    if ($debugResponse.count -gt 0) {
        Write-Host "   Documents:" -ForegroundColor Gray
        foreach ($doc in $debugResponse.docs) {
            Write-Host "   - $($doc.doc_id) (roles: $($doc.allowed_roles))" -ForegroundColor Gray
        }
    }
} catch {
    $errorDetails = $_.Exception.Response
    if ($errorDetails.StatusCode -eq 401) {
        Write-Host "❌ Authentication failed - Invalid or expired token" -ForegroundColor Red
        exit 1
    } elseif ($errorDetails.StatusCode -eq 403) {
        Write-Host "❌ Access denied - Check tenant_id in token vs request" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "⚠️  Could not check existing documents: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

# Step 4: Ingest test policy
Write-Host ""
Write-Host "[4/6] Ingesting test policy..." -ForegroundColor Yellow

$policyText = @"
1. Purpose
This policy outlines the organization's expectations regarding employee attendance, punctuality, and adherence to standard working hours to ensure smooth operations and fairness across all departments.

2. Scope
This policy applies to all full-time, part-time, and contractual employees of the company.

3. Standard Working Hours
Regular working hours are 9:00 AM to 6:00 PM, Monday through Friday.
Employees are entitled to a 1-hour lunch break between 1:00 PM and 2:00 PM.
Every employee is expected to complete 8 hours of productive work each day.
Any modification to standard working hours requires prior approval from HR or the reporting manager.

4. Attendance and Punctuality
Employees must log in and log out through the company's attendance system daily.
Late arrival is defined as reporting to work more than 10 minutes past 9:00 AM without prior notice.
Employees who are late more than three times in a month will receive a formal warning.
Continued tardiness or early departures may result in deductions or disciplinary action.

5. Absence and Leave
Any planned absence must be approved by the reporting manager in advance.
Unplanned absences due to emergencies or illness should be communicated to HR or the manager within one hour of the start of the workday.
Failure to report without notice for two consecutive days will be treated as absenteeism.

6. Breaks and Personal Time
Two short breaks of 15 minutes each (one in the morning and one in the afternoon) are permitted.
Excessive personal breaks may be considered misuse of company time and reviewed by HR.

7. Work-from-Home and Flexible Hours
Employees approved for remote work must remain available and responsive during official hours.
Flexibility in working hours can be granted only with written approval from HR.

8. Non-Compliance
Repeated non-adherence to working hours may lead to disciplinary measures including written warnings, pay deductions, or, in severe cases, termination of employment.

9. Policy Review
This policy is reviewed annually by the HR department to ensure compliance with organizational and legal standards.
"@

$ingestBody = @{
    text = $policyText
    doc_id = "work_hours_adherence_policy"
    tenant_id = $TenantId
    allowed_roles = @("employee", "hr", "ceo")
} | ConvertTo-Json -Depth 10

try {
    $ingestResponse = Invoke-RestMethod `
        -Uri "http://localhost:8001/api/v1/ingest" `
        -Method POST `
        -ContentType "application/json" `
        -Headers @{
            "Authorization" = "Bearer $Token"
        } `
        -Body $ingestBody `
        -ErrorAction Stop
    
    Write-Host "✅ Policy ingested successfully!" -ForegroundColor Green
    Write-Host "   Chunks created: $($ingestResponse.chunks_added)" -ForegroundColor Gray
    
    if ($ingestResponse.chunks_added -eq 0) {
        Write-Host "⚠️  WARNING: No chunks were created! Policy may not be indexed." -ForegroundColor Yellow
    }
} catch {
    $errorDetails = $_.Exception.Response
    if ($errorDetails.StatusCode -eq 400) {
        Write-Host "❌ Bad request: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   Check: text, doc_id, tenant_id, allowed_roles are all provided" -ForegroundColor Yellow
    } elseif ($errorDetails.StatusCode -eq 403) {
        Write-Host "❌ Access denied: Tenant ID in token doesn't match request tenant" -ForegroundColor Red
        Write-Host "   Token tenant must match: $TenantId" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Ingestion failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    exit 1
}

# Step 5: Wait and verify ingestion
Write-Host ""
Write-Host "[5/6] Verifying ingestion (waiting 2 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

try {
    $verifyResponse = Invoke-RestMethod `
        -Uri "http://localhost:8001/api/v1/ingest/debug" `
        -Headers @{
            "Authorization" = "Bearer $Token"
        } -ErrorAction Stop
    
    $found = $verifyResponse.docs | Where-Object { $_.doc_id -eq "work_hours_adherence_policy" }
    if ($found) {
        Write-Host "✅ Policy verified in vector store!" -ForegroundColor Green
        Write-Host "   Document ID: $($found.doc_id)" -ForegroundColor Gray
        Write-Host "   Allowed roles: $($found.allowed_roles)" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Policy not found in vector store - ingestion may have failed" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not verify: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Step 6: Test query
Write-Host ""
Write-Host "[6/6] Testing query..." -ForegroundColor Yellow

$queryBody = @{
    query = "What happens if an employee is late?"
    max_results = 5
} | ConvertTo-Json

try {
    $queryResponse = Invoke-RestMethod `
        -Uri "http://localhost:8001/api/v1/query" `
        -Method POST `
        -ContentType "application/json" `
        -Headers @{
            "Authorization" = "Bearer $Token"
        } `
        -Body $queryBody `
        -ErrorAction Stop
    
    Write-Host "✅ Query completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Answer:" -ForegroundColor Cyan
    Write-Host $queryResponse.text -ForegroundColor White
    Write-Host ""
    Write-Host "Confidence: $($queryResponse.confidence)" -ForegroundColor Gray
    Write-Host "Chunks used: $($queryResponse.chunks_used)" -ForegroundColor Gray
    Write-Host "Provenance:" -ForegroundColor Gray
    foreach ($prov in $queryResponse.provenance) {
        Write-Host "   - $($prov.doc_id) (similarity: $($prov.similarity))" -ForegroundColor Gray
    }
    
    if ($queryResponse.chunks_used -eq 0) {
        Write-Host ""
        Write-Host "⚠️  WARNING: No chunks were used in the answer!" -ForegroundColor Yellow
        Write-Host "   Possible causes:" -ForegroundColor Yellow
        Write-Host "   - Tenant ID mismatch between ingestion and query" -ForegroundColor Yellow
        Write-Host "   - User's role not in allowed_roles list" -ForegroundColor Yellow
        Write-Host "   - Query similarity too low" -ForegroundColor Yellow
        Write-Host "   - Check Python RAG service logs for details" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Query failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "   Response: $responseBody" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan


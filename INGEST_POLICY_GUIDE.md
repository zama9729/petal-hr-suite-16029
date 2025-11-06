# Complete Guide: Ingesting Policies into Python RAG

## 🔍 Problem: Policies Not Being Retrieved

If you're getting "No relevant policy information was found", follow these steps to properly ingest and verify policies.

---

## ✅ Step-by-Step: Ingest a Policy

### Step 1: Get a Valid JWT Token

You need a JWT token from your Node.js backend that includes:
- `user_id`
- `tenant_id` (must match the tenant you're ingesting for)
- `role` (must be in the `allowed_roles` list)

**Option A: Get token from login (recommended)**
1. Log into your HR app in the browser
2. Open browser DevTools (F12) → Application/Storage → Local Storage
3. Find the JWT token (or check your Node.js backend logs)

**Option B: Generate token via PowerShell**
```powershell
# Replace with your actual values
$user_id = "user123"
$tenant_id = "tenant_1"
$role = "hr"  # or "employee", "ceo"

# You'll need to use your Node.js backend's JWT creation function
# Or manually create if you have the secret key
```

### Step 2: Prepare the Policy Text

Create the policy text. Example for "Work Hours Adherence Policy":

```powershell
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
```

### Step 3: Build the JSON Body (PowerShell Here-String)

```powershell
$body = @"
{
  "text": "$($policyText -replace '"', '\"')",
  "doc_id": "work_hours_adherence_policy",
  "tenant_id": "tenant_1",
  "allowed_roles": ["employee", "hr", "ceo"]
}
"@
```

**⚠️ IMPORTANT Notes:**
- `doc_id` should be descriptive and unique (e.g., `"work_hours_adherence_policy"`)
- `tenant_id` must match the tenant_id in your JWT token
- `allowed_roles` must include the role of the user querying (e.g., if user is "employee", include "employee" in the list)

### Step 4: Ingest the Policy

```powershell
# Set your JWT token
$token = "<your-jwt-token-here>"

# Ingest the policy
$response = Invoke-RestMethod `
    -Uri "http://localhost:8001/api/v1/ingest" `
    -Method POST `
    -ContentType "application/json" `
    -Headers @{
        "Authorization" = "Bearer $token"
    } `
    -Body $body

$response | ConvertTo-Json -Depth 5
```

**Expected Response:**
```json
{
  "message": "✅ Policy successfully ingested",
  "chunks_added": 8
}
```

### Step 5: Verify Ingestion

#### Option A: Check Debug Endpoint

```powershell
$token = "<your-jwt-token-here>"
Invoke-RestMethod `
    -Uri "http://localhost:8001/api/v1/ingest/debug" `
    -Headers @{
        "Authorization" = "Bearer $token"
    } | ConvertTo-Json -Depth 10
```

This should list your ingested documents.

#### Option B: Check Service Logs

Look at the Python RAG service terminal. You should see:
```
INFO: [INGEST] doc_id=work_hours_adherence_policy tenant_id=tenant_1 allowed_roles=['employee','hr','ceo'] len(text)=1234
```

### Step 6: Test Query

```powershell
$token = "<your-jwt-token-here>"
$queryBody = @{
    query = "What happens if an employee is late?"
    max_results = 5
} | ConvertTo-Json

$queryResponse = Invoke-RestMethod `
    -Uri "http://localhost:8001/api/v1/query" `
    -Method POST `
    -ContentType "application/json" `
    -Headers @{
        "Authorization" = "Bearer $token"
    } `
    -Body $queryBody

$queryResponse | ConvertTo-Json -Depth 10
```

**Expected Response:**
```json
{
  "answer": "According to the Work Hours Adherence Policy...",
  "provenance": [
    {
      "source": "work_hours_adherence_policy",
      "doc_id": "work_hours_adherence_policy",
      "similarity": 0.85
    }
  ],
  "confidence": "high",
  "chunks_used": 3,
  "source": "python-rag-service-with-tools"
}
```

---

## 🔧 Complete Working Example (Copy-Paste Ready)

```powershell
# ============================================
# COMPLETE POLICY INGESTION EXAMPLE
# ============================================

# 1. Set your JWT token (get from Node.js backend or login)
$token = "<YOUR-JWT-TOKEN-HERE>"

# 2. Define the policy text
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

# 3. Escape JSON properly (replace quotes and newlines)
$escapedText = $policyText -replace '"', '\"' -replace "`r`n", "\n" -replace "`n", "\n"

# 4. Build JSON body
$bodyJson = @{
    text = $escapedText
    doc_id = "work_hours_adherence_policy"
    tenant_id = "tenant_1"
    allowed_roles = @("employee", "hr", "ceo")
} | ConvertTo-Json -Depth 10

# 5. Ingest the policy
Write-Host "Ingesting policy..." -ForegroundColor Yellow
$ingestResponse = Invoke-RestMethod `
    -Uri "http://localhost:8001/api/v1/ingest" `
    -Method POST `
    -ContentType "application/json" `
    -Headers @{
        "Authorization" = "Bearer $token"
    } `
    -Body $bodyJson

Write-Host "Ingestion Response:" -ForegroundColor Green
$ingestResponse | ConvertTo-Json -Depth 5

# 6. Verify ingestion
Write-Host "`nVerifying ingestion..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
$debugResponse = Invoke-RestMethod `
    -Uri "http://localhost:8001/api/v1/ingest/debug" `
    -Headers @{
        "Authorization" = "Bearer $token"
    }

Write-Host "Debug Response:" -ForegroundColor Green
$debugResponse | ConvertTo-Json -Depth 10

# 7. Test query
Write-Host "`nTesting query..." -ForegroundColor Yellow
$queryBody = @{
    query = "What happens if an employee is late?"
    max_results = 5
} | ConvertTo-Json

$queryResponse = Invoke-RestMethod `
    -Uri "http://localhost:8001/api/v1/query" `
    -Method POST `
    -ContentType "application/json" `
    -Headers @{
        "Authorization" = "Bearer $token"
    } `
    -Body $queryBody

Write-Host "Query Response:" -ForegroundColor Green
$queryResponse | ConvertTo-Json -Depth 10
```

---

## 🐛 Troubleshooting

### Issue 1: "No relevant policy information was found"

**Possible Causes:**
1. **Tenant ID mismatch** - JWT token's `tenant_id` doesn't match ingested policy's `tenant_id`
2. **Role mismatch** - User's role not in `allowed_roles` list
3. **Policy not properly indexed** - Check ingestion response for errors
4. **Similarity threshold too high** - Policy chunks exist but similarity scores too low

**Solutions:**

#### Check Tenant ID Match
```powershell
# Decode your JWT to see tenant_id
# In PowerShell (requires jwt module or use online JWT decoder)
# Or check your Node.js backend logs

# Make sure the tenant_id in your ingestion matches:
# - The tenant_id in your JWT token
# - The tenant_id you're querying with
```

#### Check Role Inclusion
```powershell
# If user is "employee", ingestion must include "employee" in allowed_roles:
"allowed_roles": ["employee", "hr", "ceo"]  # ✅ Correct

# NOT:
"allowed_roles": ["hr", "ceo"]  # ❌ Wrong - employee can't query
```

#### Lower Similarity Threshold (Temporary Debug)
The retrieval logic has a `min_similarity` threshold. If policies aren't being found, the similarity might be too low. Check the Python service logs for:
```
⚠️ Tenant/role mismatch: Retrieved X docs, but 0 matched tenant_id=..., role=...
```

#### Verify Policy Was Indexed
```powershell
# Check the ingestion response - should show chunks_added > 0
{
  "message": "✅ Policy successfully ingested",
  "chunks_added": 8  # Should be > 0
}

# Check debug endpoint
Invoke-RestMethod -Uri "http://localhost:8001/api/v1/ingest/debug" -Headers @{ Authorization = "Bearer $token" }
```

### Issue 2: "Invalid token" or "Not authenticated"

**Solution:**
- Make sure JWT token is valid and not expired
- Verify `JWT_SECRET_KEY` matches between Python service and Node.js backend
- Check token format: `Authorization: Bearer <token>`

### Issue 3: "Access denied for this tenant"

**Solution:**
- The `tenant_id` in your JWT token doesn't match the `tenant_id` in the ingestion request
- Make sure they're exactly the same (case-sensitive)

### Issue 4: Ingestion succeeds but query returns empty

**Check:**
1. **Same tenant_id?** - Query and ingestion must use same tenant
2. **Role in allowed_roles?** - User's role must be in the policy's `allowed_roles`
3. **Service logs** - Check Python RAG service terminal for diagnostic messages
4. **Vector store persistence** - If using ChromaDB, check `./chroma_db` directory exists

### Issue 5: JSON parsing errors in PowerShell

**Solution:** Use the here-string method shown above, or build JSON using `ConvertTo-Json`:
```powershell
$body = @{
    text = $policyText
    doc_id = "work_hours_policy"
    tenant_id = "tenant_1"
    allowed_roles = @("employee", "hr", "ceo")
} | ConvertTo-Json -Depth 10
```

---

## ✅ Verification Checklist

After ingestion, verify:

- [ ] Ingestion response shows `chunks_added > 0`
- [ ] Debug endpoint lists your document
- [ ] Python service logs show successful indexing
- [ ] JWT token has correct `tenant_id` and `role`
- [ ] Policy `allowed_roles` includes user's role
- [ ] Query uses same `tenant_id` as ingestion
- [ ] Service health check returns `"status": "healthy"`

---

## 📝 Important Notes

1. **Tenant Isolation**: Each tenant's policies are completely separate. You must use the same `tenant_id` for both ingestion and query.

2. **Role-Based Access**: A user can only query policies where their role is in the `allowed_roles` list.

3. **Document ID**: Use descriptive, unique `doc_id` values (e.g., `"work_hours_adherence_policy"` not just `"policy"`).

4. **Chunking**: Policies are automatically chunked into ~800 character segments with 100 character overlap.

5. **Similarity Threshold**: The retrieval uses a minimum similarity threshold. If your query is very different from the policy text, it might not match. Try querying with keywords that appear in the policy.

---

## 🎯 Quick Test: Verify Everything Works

```powershell
# 1. Health check
Invoke-RestMethod -Uri http://localhost:8001/health | ConvertTo-Json

# 2. Ingest a simple policy
$token = "<your-token>"
$body = @{
    text = "Employees must arrive at work by 9:00 AM. Late arrivals after 9:10 AM without notice will receive a warning after three occurrences in a month."
    doc_id = "test_policy"
    tenant_id = "tenant_1"
    allowed_roles = @("employee", "hr", "ceo")
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:8001/api/v1/ingest -Method POST -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $body

# 3. Query with keywords from the policy
$query = @{
    query = "What happens if I arrive late?"
    max_results = 5
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:8001/api/v1/query -Method POST -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $query | ConvertTo-Json -Depth 10
```

If this works, your setup is correct! If not, check the troubleshooting section above.


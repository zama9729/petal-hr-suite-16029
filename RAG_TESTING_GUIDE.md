# RAG System Testing Guide

## Prerequisites Check

1. **Verify services are running:**
   - Python RAG microservice: `http://localhost:8000/health`
   - Node.js HR backend: `http://localhost:3001/api/health` (or check if frontend loads)
   - Frontend: `http://localhost:8080` (or your configured port)

2. **Check environment variables:**
   - `OPENAI_API_KEY` (optional, for better embeddings/LLM)
   - `JWT_SECRET_KEY` (should match between Node backend and Python service)

---

## Method 1: Testing via UI (Easiest)

### Step 1: Login to the HR Application
1. Open `http://localhost:8080` (or your frontend URL)
2. Login with a user that has **HR, Director, or CEO** role
3. Navigate to **RAG** section in the sidebar → **RAG Console**

### Step 2: Ingest a Document
1. Click the **"Ingest"** tab
2. Fill in:
   - **Document ID**: `medical-leave-policy-2025`
   - **Text**: Paste your leave policy content (see example below)
   - **Allowed roles**: `hr,ceo,employee` (comma-separated)
   - **Confidentiality**: `internal` or `confidential`
3. Click **"Ingest"** button
4. You should see: "Ingested successfully"

### Step 3: Query the RAG
1. Click the **"Query"** tab
2. Enter a question, e.g.:
   - "What is the medical leave policy?"
   - "How many days of medical leave do employees get?"
   - "What are the eligibility requirements for medical leave?"
3. Click **"Ask"** button
4. Review:
   - **Answer**: The LLM-generated response
   - **Confidence**: low/medium/high
   - **Provenance**: Document IDs used

### Example Document to Test:
```
Medical Leave Policy (2025)

1. Purpose
This policy provides employees with paid time off to recover from illness, injury, or medical procedures.

2. Eligibility
All full-time employees who have completed at least 90 days of service are eligible.

3. Duration
Employees are entitled to 15 days of paid medical leave per calendar year.

4. Application Process
Employees must submit a medical leave request through the HR portal at least 3 days in advance, or immediately in case of emergencies.

5. Documentation
A medical certificate from a licensed physician is required for leaves exceeding 3 consecutive days.

6. Unused Leave
Unused medical leave does not carry over to the next year.

7. Return to Work
Employees must provide a fitness certificate before resuming duties after a leave of 7 days or more.
```

---

## Method 2: Testing via API (Advanced)

### Step 1: Get Authentication Token

**Option A: Use existing login token**
- Login via UI and copy the token from browser localStorage: `auth_token`

**Option B: Generate a test token**
```bash
# In Node.js backend directory
node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign(
  { user_id: '1', tenant_id: 'tenant_1', role: 'hr' },
  process.env.JWT_SECRET_KEY || 'your-secret-key',
  { expiresIn: '1h' }
);
console.log('Token:', token);
"
```

### Step 2: Ingest Document via API

```bash
curl -X POST http://localhost:3001/api/rag/upsert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "doc_id": "medical-leave-policy-2025",
    "text": "Medical Leave Policy (2025)\n\n1. Purpose\nThis policy provides employees with paid time off to recover from illness, injury, or medical procedures.\n\n2. Eligibility\nAll full-time employees who have completed at least 90 days of service are eligible.\n\n3. Duration\nEmployees are entitled to 15 days of paid medical leave per calendar year.",
    "allowed_roles": ["hr", "ceo", "employee"],
    "confidentiality_level": "internal"
  }'
```

**Expected response:**
```json
{
  "ok": true,
  "chunks_created": 3,
  "doc_id": "medical-leave-policy-2025"
}
```

### Step 3: Query RAG via API

```bash
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "query": "How many days of medical leave do employees get?"
  }'
```

**Expected response:**
```json
{
  "text": "Employees are entitled to 15 days of paid medical leave per calendar year.",
  "model": "gpt-3.5-turbo",
  "provenance": [
    { "id": "chunk_123", "doc_id": "medical-leave-policy-2025" }
  ],
  "confidence": "high"
}
```

---

## Method 3: Testing Python RAG Microservice Directly

### Step 1: Generate JWT Token

```python
import jwt
import datetime

SECRET = "your-secret-key-change-in-production"
payload = {
    "user_id": "user_123",
    "tenant_id": "tenant_1",
    "role": "hr",
    "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1)
}
token = jwt.encode(payload, SECRET, algorithm="HS256")
print(f"Token: {token}")
```

### Step 2: Test Health Endpoint

```bash
curl http://localhost:8000/health
```

**Expected:**
```json
{
  "status": "healthy",
  "vector_db": "in-memory",
  "persist_dir": "./chroma_db"
}
```

### Step 3: Upload Document to Python Service

```bash
curl -X POST http://localhost:8000/api/v1/documents/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "doc_id": "test-policy",
    "tenant_id": "tenant_1",
    "allowed_roles": ["hr", "ceo"],
    "confidentiality_level": "internal",
    "content": "Employees get 15 days of medical leave per year.",
    "source_type": "policy"
  }'
```

### Step 4: Query Python Service

```bash
curl -X POST http://localhost:8000/api/v1/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How many days of medical leave?",
    "max_results": 5
  }'
```

---

## Troubleshooting

### Issue: "No LLM configured"
**Solution:** Set `OPENAI_API_KEY` environment variable, or the system will use fallback logic.

### Issue: "Token expired" or "Invalid token"
**Solution:** 
- Check `JWT_SECRET_KEY` matches between Node backend and Python service
- Generate a new token
- Ensure token hasn't expired (default: 1 hour)

### Issue: "No organization found" or "No tenant_id"
**Solution:**
- Ensure user is logged in and has a valid profile with `tenant_id`
- Check `profiles` table in database

### Issue: Low confidence or empty results
**Solution:**
- Ensure documents are ingested (check `rag_chunks` table)
- Try querying with more specific terms
- Check if document's `allowed_roles` includes your user's role
- Verify `tenant_id` matches between documents and user

### Issue: RAG service not responding
**Solution:**
- Check if Python service is running: `curl http://localhost:8000/health`
- Check logs for errors
- Verify port 8000 is not blocked

---

## Verification Checklist

- [ ] Services running (Node backend, Python RAG, Frontend)
- [ ] User logged in with HR/CEO/Director role
- [ ] Document ingested successfully
- [ ] Query returns relevant answer
- [ ] Confidence score is medium or high
- [ ] Provenance shows correct document IDs
- [ ] Audit logs are being created (check `rag_audit_logs` table)

---

## Next Steps

1. **Test multi-tenant isolation**: Create documents for different tenants and verify queries only return tenant-scoped results
2. **Test RBAC**: Create documents with restricted roles and verify users can only see allowed documents
3. **Test with real policies**: Ingest actual HR policies and test various query patterns
4. **Monitor performance**: Check query latency and optimize if needed

---

## Quick Test Script

Save this as `test-rag.sh`:

```bash
#!/bin/bash
TOKEN="YOUR_TOKEN_HERE"
API_URL="http://localhost:3001"

echo "1. Ingesting document..."
curl -X POST $API_URL/api/rag/upsert \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"doc_id":"test-doc","text":"Medical leave is 15 days per year.","allowed_roles":["hr","employee"],"confidentiality_level":"internal"}'

echo -e "\n\n2. Querying RAG..."
curl -X POST $API_URL/api/rag/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"How many days of medical leave?"}'

echo -e "\n\nDone!"
```

Run: `bash test-rag.sh`




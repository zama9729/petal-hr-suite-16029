# How to Check RAG Response JSON

There are **3 easy ways** to check the response JSON and verify which service is being used:

---

## Method 1: In the UI (Easiest - Just Added!)

1. **Go to RAG Console** → Query tab
2. **Enter your query** (e.g., "appraisal")
3. **Click "Ask"**
4. **Look for the blue badge** showing `Source: python-rag-service` or `Source: local-nodejs`
5. **Click "Show Raw JSON Response"** button to see the full JSON

**What to look for:**
```json
{
  "text": "The answer...",
  "confidence": "high",
  "source": "python-rag-service",  // ← This tells you which service was used
  "provenance": [...]
}
```

---

## Method 2: Browser Developer Tools (Network Tab)

1. **Open Developer Tools**: Press `F12` or right-click → Inspect
2. **Go to Network tab**
3. **Make a query** in the RAG Console
4. **Find the request** named `query` or filter by "rag"
5. **Click on the request**
6. **Click "Response" tab** to see the JSON

**Steps:**
```
F12 → Network → Make query → Click request → Response tab
```

---

## Method 3: Browser Console (Already Logged!)

1. **Open Developer Tools**: Press `F12`
2. **Go to Console tab**
3. **Make a query** in the RAG Console
4. **Look for**: `[RAG Response]` log entry

The response is automatically logged to console with this format:
```javascript
[RAG Response] {
  text: "...",
  confidence: "high",
  source: "python-rag-service",
  provenance: [...]
}
```

---

## Method 4: Direct API Call (Using curl/Postman)

### Get your auth token:
1. Open browser console (F12)
2. Run: `localStorage.getItem('auth_token')`
3. Copy the token

### Make API call:
```bash
curl -X POST http://localhost:3001/api/rag/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"query": "appraisal"}' | jq
```

**Output:**
```json
{
  "text": "...",
  "confidence": "high",
  "source": "python-rag-service",
  "provenance": [...]
}
```

---

## What the "source" field means:

- **`python-rag-service`**: Python RAG microservice is being used (port 8000)
- **`local-nodejs`**: Fallback to local Node.js retrieval (PostgreSQL-based)
- **`local-fallback`**: No results found, using fallback message

---

## Quick Verification Checklist:

✅ **Python service is running?**
```bash
curl http://localhost:8000/health
# Should return: {"status":"healthy",...}
```

✅ **Python service is being used?**
- Check the `source` field in response = `"python-rag-service"`
- Or check browser console for `[RAG Response]` log

✅ **Service fell back to local?**
- `source` = `"local-nodejs"` means Python service unavailable or failed
- Check Python service logs for errors

---

## Troubleshooting:

**If you see `"source": "local-nodejs"` but Python service is running:**
1. Check `RAG_API_URL` environment variable in Node backend
2. Check Python service logs for authentication errors
3. Verify JWT_SECRET_KEY matches between services

**If you don't see a `source` field:**
- The response might be from an older version
- Restart the Node.js backend to load the new code




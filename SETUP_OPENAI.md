# Setup OpenAI API Key for Better RAG Responses

## Current Issue

Your response shows: `"No LLM configured"` - this means the system is returning raw chunks instead of a proper LLM-generated answer.

## Solution: Add OpenAI API Key

### Option 1: Environment Variable (Recommended)

1. **Create or edit `.env` file in the `server/` directory:**
   ```bash
   cd server
   # Create .env file if it doesn't exist
   ```

2. **Add your OpenAI API key:**
   ```env
   OPENAI_API_KEY=sk-your-actual-api-key-here
   RAG_API_URL=http://localhost:8000
   JWT_SECRET_KEY=your-secret-key-change-in-production
   ```

3. **Restart the Node.js backend:**
   ```bash
   # Stop the current server (Ctrl+C)
   # Then restart:
   npm run dev
   ```

### Option 2: Docker Environment

If you're using Docker, add to `docker-compose.yml`:

```yaml
services:
  api:
    environment:
      - OPENAI_API_KEY=sk-your-actual-api-key-here
      - RAG_API_URL=http://localhost:8000
```

Then restart:
```bash
docker compose restart api
```

## Get Your OpenAI API Key

1. Go to: https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. **Important**: Save it securely - you won't see it again!

## Verify It's Working

After adding the key and restarting:

1. Make a query in RAG Console
2. Check the response - it should be:
   - A proper, formatted answer (not raw chunks)
   - `"model": "gpt-4o-mini"` or similar (not `"none"`)
   - No "No LLM configured" message

## Cost Note

- OpenAI charges per API call
- `gpt-4o-mini` is the cheapest option (~$0.15 per 1M input tokens)
- For testing, costs are minimal
- You can set a usage limit at: https://platform.openai.com/usage

## Alternative: Use Python RAG Service (If Available)

If the Python RAG service is running and has OpenAI configured, queries will automatically use it instead of the local Node.js service.




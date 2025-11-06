// Server-side helper to ask the Python RAG microservice first, then fallback locally
import { createUserJWT } from '../utils/jwt.js';
import { query as db } from '../db/pool.js';

async function callPythonRAG({ queryText, ragApiUrl, token, maxResults = 5 }) {
  const url = `${ragApiUrl.replace(/\/$/, '')}/api/v1/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query: String(queryText || ''), max_results: Number(maxResults) }),
  });
  if (!res.ok) {
    // Try to extract detailed error text from Python RAG
    const errText = await res.text().catch(() => '');
    throw new Error(`Python RAG returned ${res.status}: ${errText}`);
  }
  const data = await res.json().catch(async () => {
    const raw = await res.text().catch(() => '');
    throw new Error(`Python RAG invalid JSON response: ${raw}`);
  });
  return data;
}

async function fallbackLocalRetrieve(queryText) {
  // Attempt to dynamically import local retrieval logic
  const candidatePaths = [
    '../../src/lib/ef10e3e8-cd99-4620-bf33-5bf6ad2161e3.js',
    '../lib/ef10e3e8-cd99-4620-bf33-5bf6ad2161e3.js',
    './ef10e3e8-cd99-4620-bf33-5bf6ad2161e3.js',
  ];
  for (const p of candidatePaths) {
    try {
      const mod = await import(p);
      if (typeof mod.default === 'function') {
        return await mod.default(queryText);
      }
      if (typeof mod.retrieve === 'function') {
        return await mod.retrieve(queryText);
      }
    } catch (_) {
      // try next
    }
  }
  // Minimal safe fallback
  return {
    answer: "RAG service is unavailable. I couldn’t find tenant-allowed info for that.",
    provenance: [],
    confidence: 'low',
  };
}

export async function askHR(req, queryText) {
  const ragBaseUrl = process.env.RAG_API_URL || 'http://localhost:8001';

  // 1) Always mint a fresh JWT aligned with Python service secret/claims
  let token = '';
  if (req.user?.id && req.user?.role) {
    let tenantId = req.user.tenant_id;
    if (!tenantId) {
      try {
        const res = await db('SELECT tenant_id FROM profiles WHERE id=$1', [req.user.id]);
        tenantId = res.rows[0]?.tenant_id || null;
      } catch (_) {}
    }
    if (!tenantId) {
      try {
        const res2 = await db('SELECT tenant_id FROM user_roles WHERE user_id=$1 LIMIT 1', [req.user.id]);
        tenantId = res2.rows[0]?.tenant_id || null;
      } catch (_) {}
    }
    if (tenantId) {
      token = createUserJWT({ userId: req.user.id, tenantId, role: req.user.role });
    }
    // Debug logs (safe): show whether token was minted and target URL (no secrets)
    console.log('[RAG] target', ragBaseUrl, 'tenant', tenantId || '(none)', 'token', token ? 'minted' : 'missing');
  }

  // 2) Call Python RAG microservice ONLY (no JS fallback)
  const res = await callPythonRAG({ queryText: String(queryText || ''), ragApiUrl: ragBaseUrl, token, maxResults: 5 });
  console.log('[RAG] Using Python RAG');
  return {
    answer: res.answer || res.text || '',
    provenance: res.provenance || [],
    confidence: res.confidence || 'low',
    source: 'python-rag-service',
  };
}

export default { askHR };




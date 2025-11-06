import { createUserJWT } from '../utils/jwt.js';
import { retrieve as localRetrieve, buildPrompt, answerWithLLM } from './rag.js';

function getRagApiUrl() {
  return process.env.RAG_API_URL || 'http://localhost:8001';
}

function getJwtFromReq(req) {
  const authHeader = req.headers?.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice('Bearer '.length);
  if (req.user?.id && req.user?.tenant_id && req.user?.role) {
    return createUserJWT({ userId: req.user.id, tenantId: req.user.tenant_id, role: req.user.role });
  }
  return '';
}

async function callPythonRAG({ req, queryText, maxResults = 6 }) {
  const token = getJwtFromReq(req);
  const base = getRagApiUrl().replace(/\/$/, '');
  const url = `${base}/api/v1/query`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query: String(queryText || ''), max_results: Number(maxResults) })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || data?.error || `Python RAG error (${res.status})`);
  console.log('[RAG] Using Python RAG');
  return {
    answer: data.answer || data.text || '',
    confidence: data.confidence || 'low',
    provenance: data.provenance || [],
    tool_calls: data.tool_calls || [],
    tool_results: data.tool_results || [],
    source: 'python-rag-service',
  };
}

async function callLocalRAG({ tenantId, role, queryText, maxResults = 6, req }) {
  // Use local PG-backed retrieval
  const { chunks, confidence } = await localRetrieve({ tenantId, role: role || 'employee', queryText, topK: maxResults });
  if (!chunks?.length) {
    return {
      answer: "I couldn’t find tenant-allowed info for that.",
      confidence: 'low',
      provenance: [],
      tool_calls: [],
      tool_results: [],
      source: 'local-rag',
    };
  }
  const prompt = buildPrompt({ tenantName: 'tenant', queryText, chunks });
  const ans = await answerWithLLM(prompt);
  console.log('[RAG] Using local fallback');
  return {
    answer: ans.text,
    confidence: confidence < 0.4 ? 'low' : confidence < 0.7 ? 'medium' : 'high',
    provenance: chunks.map(c => ({ id: c.id, doc_id: c.doc_id })),
    tool_calls: [],
    tool_results: [],
    source: 'local-rag',
  };
}

export async function hybridQuery(req, { tenantId, role, queryText, maxResults = 6 }) {
  // Try Python first
  try {
    return await callPythonRAG({ req, queryText, maxResults });
  } catch (e) {
    // Fallback to local
    return await callLocalRAG({ tenantId, role, queryText, maxResults, req });
  }
}

export async function ragStatus(req) {
  const base = getRagApiUrl().replace(/\/$/, '');
  let python = { ok: false, error: '' };
  try {
    const r = await fetch(`${base}/health`, { method: 'GET' });
    python.ok = r.ok;
    if (!r.ok) python.error = `HTTP ${r.status}`;
  } catch (e) {
    python.error = String(e?.message || e);
  }
  return { python, local: { ok: true } };
}

export default { hybridQuery, ragStatus };





// Lightweight client for the Python RAG microservice
// Reads base URL and JWT from environment/session

function getBaseUrl() {
  // Priority: Vite env → window runtime var → localStorage override → default
  const fromVite = (typeof import !== 'undefined' && import.meta && import.meta.env && import.meta.env.VITE_RAG_API_URL) || '';
  const fromWindow = (typeof window !== 'undefined' && (window.__RAG_API_URL__ || window.RAG_API_URL)) || '';
  const fromStorage = (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('RAG_API_URL')) || '';
  return String(fromVite || fromWindow || fromStorage || 'http://localhost:8000');
}

function getJwtToken() {
  // Try common app tokens, then explicit override
  const fromStoragePrimary = (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('auth_token')) || '';
  const fromStorageAlt = (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('JWT_TOKEN')) || '';
  const fromVite = (typeof import !== 'undefined' && import.meta && import.meta.env && import.meta.env.VITE_JWT_TOKEN) || '';
  const fromWindow = (typeof window !== 'undefined' && (window.__JWT_TOKEN__ || window.JWT_TOKEN)) || '';
  return String(fromStoragePrimary || fromStorageAlt || fromVite || fromWindow || '');
}

async function ragFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const baseUrl = getBaseUrl();
  const token = getJwtToken();
  const url = `${baseUrl}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch (_e) {
    const text = await res.text().catch(() => '');
    throw new Error(`RAG request failed to parse JSON (status ${res.status}): ${text}`);
  }

  if (!res.ok) {
    const message = data?.error || data?.detail || `Request failed with status ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export async function queryRAG(queryText, opts = {}) {
  try {
    const resp = await ragFetch('/api/v1/query', {
      method: 'POST',
      body: { query: String(queryText || ''), max_results: Number(opts.maxResults || 5) },
    });
    // Optional logging of confidence/provenance
    if (resp?.confidence) console.info('[RAG] confidence:', resp.confidence);
    if (resp?.provenance) console.info('[RAG] provenance:', resp.provenance);
    return resp;
  } catch (err) {
    console.error('[RAG] query error:', err);
    return { error: String(err?.message || err), confidence: 'low', provenance: [] };
  }
}

export async function uploadDocument(docData) {
  // Expected: { doc_id, tenant_id, allowed_roles, confidentiality_level, content, source_type }
  try {
    const resp = await ragFetch('/api/v1/documents/upload', {
      method: 'POST',
      body: {
        doc_id: String(docData?.doc_id || ''),
        tenant_id: String(docData?.tenant_id || ''),
        allowed_roles: Array.isArray(docData?.allowed_roles) ? docData.allowed_roles : [],
        confidentiality_level: String(docData?.confidentiality_level || 'internal'),
        content: String(docData?.content || ''),
        source_type: String(docData?.source_type || 'text'),
      },
    });
    return resp;
  } catch (err) {
    console.error('[RAG] upload error:', err);
    return { error: String(err?.message || err) };
  }
}

export async function indexTenant(tenantId) {
  try {
    const resp = await ragFetch(`/api/v1/index/tenant/${encodeURIComponent(String(tenantId || ''))}`, {
      method: 'POST',
    });
    return resp;
  } catch (err) {
    console.error('[RAG] index tenant error:', err);
    return { error: String(err?.message || err) };
  }
}

export default { queryRAG, uploadDocument, indexTenant };






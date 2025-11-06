import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { query as db } from '../db/pool.js';
import { upsertDocument, generateSafeSQLTemplate, logAudit } from '../services/rag.js';
import { askHR } from '../services/askHR.js';
import { createUserJWT } from '../utils/jwt.js';
// Using built-in fetch (Node.js 18+)
// import fetch from 'node-fetch'; // Not needed - using global fetch

const router = express.Router();

async function getTenantId(userId) {
  const res = await db('SELECT tenant_id FROM profiles WHERE id=$1', [userId]);
  return res.rows[0]?.tenant_id || null;
}

// Normalize query: fix common typos and expand abbreviations
function normalizeQuery(query) {
  const fixes = {
    'apraisal': 'appraisal',
    'apprasial': 'appraisal',
    'apprisal': 'appraisal',
    'leave policy': 'leave policy',
    'medical leave': 'medical leave',
    'maternity leave': 'maternity leave',
  };
  let normalized = String(query || '').toLowerCase().trim();
  for (const [typo, correct] of Object.entries(fixes)) {
    if (normalized.includes(typo)) {
      normalized = normalized.replace(new RegExp(typo, 'gi'), correct);
    }
  }
  return normalized;
}

// Upsert document/text into RAG store
router.post('/upsert', authenticateToken, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user.id);
    if (!tenantId) return res.status(403).json({ error: 'No organization found' });
    const { doc_id, text, allowed_roles, confidentiality_level, pii_flags } = req.body || {};
    if (!doc_id || !text) return res.status(400).json({ error: 'doc_id and text are required' });
    const result = await upsertDocument({
      tenantId,
      docId: String(doc_id),
      text: String(text),
      // Default to broad access so regular users can retrieve unless explicitly restricted
      allowedRoles: allowed_roles && allowed_roles.length ? allowed_roles : ['employee','hr','ceo'],
      confidentiality: confidentiality_level || 'internal',
      piiFlags: pii_flags || {}
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('RAG upsert error', e);
    res.status(500).json({ error: e.message });
  }
});

// Generate a safe SQL template for a natural-language intent (never executed here)
router.post('/sql/generate', authenticateToken, async (req, res) => {
  const { intent } = req.body || {};
  const tpl = generateSafeSQLTemplate(String(intent || ''));
  res.json(tpl);
});

// Query RAG with RBAC and tenant-scoped retrieval (Python ONLY)
router.post('/query', authenticateToken, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user.id);
    if (!tenantId) return res.status(403).json({ error: 'No organization found' });
    const { role } = (await db('SELECT role FROM user_roles WHERE user_id=$1', [req.user.id])).rows[0] || {};
    const { query: q } = req.body || {};
    if (!q) return res.status(400).json({ error: 'query is required' });

    // Normalize query (fix typos)
    const normalizedQuery = normalizeQuery(q);

    // Python RAG only
    const result = await askHR(req, normalizedQuery);
    await logAudit({ 
      userId: req.user.id, 
      tenantId, 
      role, 
      queryText: normalizedQuery, 
      chunkIds: (result.provenance || []).map(p => p.doc_id || p.id),
      confidence: result.confidence === 'high' ? 0.8 : result.confidence === 'medium' ? 0.5 : 0.3
    });
    return res.json({
      text: result.answer || result.text || '',
      provenance: result.provenance,
      confidence: result.confidence,
      source: result.source,
      tool_calls: result.tool_calls || [],
      tool_results: result.tool_results || [],
    });
  } catch (e) {
    console.error('RAG query error (python only)', e);
    res.status(503).json({ error: 'Python RAG service unavailable', detail: e?.message || String(e) });
  }
});

// Ingest document to Python RAG service
router.post('/ingest', authenticateToken, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user.id);
    if (!tenantId) return res.status(403).json({ error: 'No organization found' });
    
    const { text, doc_id, allowed_roles } = req.body || {};
    if (!text || !doc_id) {
      return res.status(400).json({ error: 'text and doc_id are required' });
    }

    // Get user role for JWT
    const { role } = (await db('SELECT role FROM user_roles WHERE user_id=$1', [req.user.id])).rows[0] || {};
    const userRole = role || req.user.role || 'employee';

    // Create JWT token for Python RAG service
    const token = createUserJWT({ 
      userId: req.user.id, 
      tenantId, 
      role: userRole 
    });

    // Call Python RAG ingest endpoint
    const ragBaseUrl = (process.env.RAG_API_URL || 'http://localhost:8001').replace(/\/$/, '');
    const ingestUrl = `${ragBaseUrl}/api/v1/ingest`;
    
    const ingestPayload = {
      text: String(text),
      doc_id: String(doc_id),
      tenant_id: String(tenantId),
      allowed_roles: Array.isArray(allowed_roles) && allowed_roles.length > 0 
        ? allowed_roles 
        : ['employee', 'hr', 'ceo']
    };

    const pythonRes = await fetch(ingestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(ingestPayload)
    });

    const pythonData = await pythonRes.json().catch(() => ({}));
    
    if (!pythonRes.ok) {
      const errorMsg = pythonData.detail || pythonData.error || `Python RAG service error (status ${pythonRes.status})`;
      console.error('[RAG Ingest] Python service error:', errorMsg);
      return res.status(pythonRes.status || 500).json({ error: errorMsg });
    }

    // Log audit
    await logAudit({
      userId: req.user.id,
      tenantId,
      role: userRole,
      queryText: `Ingest document: ${doc_id}`,
      chunkIds: [],
      confidence: 1.0
    });

    return res.json({
      message: pythonData.message || '✅ Policy successfully ingested',
      chunks_added: pythonData.chunks_added || 0,
      doc_id: doc_id
    });
  } catch (e) {
    console.error('[RAG Ingest] Error:', e);
    res.status(500).json({ error: e.message || 'Failed to ingest document' });
  }
});

// Get list of indexed documents (debug)
router.get('/ingest/debug', authenticateToken, async (req, res) => {
  try {
    const tenantId = await getTenantId(req.user.id);
    if (!tenantId) return res.status(403).json({ error: 'No organization found' });

    const { role } = (await db('SELECT role FROM user_roles WHERE user_id=$1', [req.user.id])).rows[0] || {};
    const userRole = role || req.user.role || 'employee';

    const token = createUserJWT({ 
      userId: req.user.id, 
      tenantId, 
      role: userRole 
    });

    const ragBaseUrl = (process.env.RAG_API_URL || 'http://localhost:8001').replace(/\/$/, '');
    const debugUrl = `${ragBaseUrl}/api/v1/ingest/debug`;

    const pythonRes = await fetch(debugUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const pythonData = await pythonRes.json().catch(() => ({}));
    
    if (!pythonRes.ok) {
      return res.status(pythonRes.status || 500).json({ 
        error: pythonData.detail || pythonData.error || 'Failed to fetch documents' 
      });
    }

    return res.json(pythonData);
  } catch (e) {
    console.error('[RAG Debug] Error:', e);
    res.status(500).json({ error: e.message || 'Failed to fetch documents' });
  }
});

// Health check both RAGs
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const base = (process.env.RAG_API_URL || 'http://localhost:8001').replace(/\/$/, '');
    let python = { ok: false, error: '' };
    try {
      const r = await fetch(`${base}/health`, { method: 'GET' });
      python.ok = r.ok;
      if (!r.ok) python.error = `HTTP ${r.status}`;
    } catch (e) {
      python.error = String(e?.message || e);
    }
    res.json({ python, local: { ok: false } });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'status check failed' });
  }
});

export default router;




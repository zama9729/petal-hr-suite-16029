import crypto from 'crypto';
import { query as db } from '../db/pool.js';

function chunkText(text, maxLen = 800) {
  const parts = [];
  let current = '';
  for (const para of String(text).split(/\n\n+/)) {
    if ((current + '\n\n' + para).length > maxLen && current) {
      parts.push(current);
      current = para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }
  if (current) parts.push(current);
  return parts;
}

async function embed(text) {
  const key = process.env.OPENAI_API_KEY || '';
  if (key) {
    const resp = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ input: text, model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small' })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error?.message || 'Embedding failed');
    return data.data[0].embedding;
  }
  // Fallback: deterministic hash-based pseudo-embedding (not semantic)
  const hash = crypto.createHash('sha256').update(text).digest();
  const arr = new Array(256).fill(0).map((_, i) => hash[i % hash.length] / 255);
  return arr;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

export async function upsertDocument({ tenantId, docId, text, allowedRoles = ['hr','ceo'], confidentiality = 'internal', piiFlags = {} }) {
  const chunks = chunkText(text);
  for (const chunk of chunks) {
    const vec = await embed(chunk);
    await db(
      `INSERT INTO rag_chunks (tenant_id, doc_id, chunk, embedding, allowed_roles, confidentiality_level, pii_flags)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [tenantId, docId, chunk, vec, allowedRoles, confidentiality, piiFlags]
    );
  }
  return { chunks: chunks.length };
}

export async function retrieve({ tenantId, role, queryText, topK = 8 }) {
  const qvec = await embed(queryText);
  const tokens = String(queryText).toLowerCase().match(/[a-z0-9]+/g) || [];

  // Pull a manageable subset and score in app
  const { rows } = await db(
    `SELECT id, doc_id, chunk, allowed_roles, embedding FROM rag_chunks WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 2000`,
    [tenantId]
  );

  // RBAC filter first
  let candidates = rows.filter(r => (Array.isArray(r.allowed_roles) ? r.allowed_roles.includes(role) : true));

  // Enhanced document type detection: if query clearly targets a document type, strongly prefer it
  const docTypeKeywords = {
    'appraisal': ['appraisal', 'performance', 'review', 'evaluation'],
    'medical': ['medical', 'illness', 'sick', 'health'],
    'maternity': ['maternity', 'pregnancy', 'pregnant', 'delivery', 'childbirth'],
    'leave': ['leave', 'vacation', 'time off'],
  };
  
  // Detect which document type the query is about
  let detectedDocTypes = new Set();
  for (const [docType, keywords] of Object.entries(docTypeKeywords)) {
    if (keywords.some(kw => tokens.some(t => t.includes(kw) || kw.includes(t)))) {
      detectedDocTypes.add(docType);
    }
  }

  // If we detected a specific document type, filter to docs that match
  if (detectedDocTypes.size > 0) {
    const matchingDocs = candidates.filter(r => {
      const docIdLower = String(r.doc_id || '').toLowerCase();
      const chunkLower = String(r.chunk || '').toLowerCase();
      return Array.from(detectedDocTypes).some(type => 
        docIdLower.includes(type) || chunkLower.includes(type)
      );
    });
    // Only use filtered docs if we have enough candidates (at least 5)
    if (matchingDocs.length >= 5) {
      candidates = matchingDocs;
    }
  }

  // Also check for doc_id hints (fallback)
  const hintedDocIds = new Set(
    candidates
      .map(r => r.doc_id)
      .filter(Boolean)
      .filter(docId => {
        const d = String(docId).toLowerCase();
        return tokens.some(t => d.includes(t) || t.length > 4 && d.includes(t.substring(0, 4)));
      })
  );
  if (hintedDocIds.size > 0 && hintedDocIds.size <= 3) {
    // If only 1-3 docs match, strongly prefer them
    const hinted = candidates.filter(r => hintedDocIds.has(r.doc_id));
    if (hinted.length >= Math.min(10, candidates.length / 2)) {
      candidates = hinted;
    }
  }

  // Score with cosine; add slight keyword overlap boost
  const keywordBoost = (text) => {
    const lower = String(text).toLowerCase();
    let hits = 0;
    for (const t of tokens) if (lower.includes(t)) hits++;
    return Math.min(0.15, hits * 0.02); // cap boost
  };

  const scoredAll = candidates.map(r => ({
    ...r,
    score: cosine(qvec, r.embedding)
  })).map(r => ({ ...r, score: r.score + keywordBoost(r.chunk) }));

  // Identify dominant document by aggregate score among top N
  const topForDocDetect = [...scoredAll].sort((a,b) => b.score - a.score).slice(0, 30);
  const byDoc = new Map();
  for (const r of topForDocDetect) {
    const key = r.doc_id || 'unknown';
    const prev = byDoc.get(key) || { total: 0, count: 0 };
    prev.total += r.score;
    prev.count += 1;
    byDoc.set(key, prev);
  }
  let dominantDocId = null, bestTotal = -Infinity;
  for (const [docId, agg] of byDoc.entries()) {
    if (agg.total > bestTotal) { bestTotal = agg.total; dominantDocId = docId; }
  }

  // Stricter threshold to drop weak matches and prevent mixing different document types
  const sorted = [...scoredAll].sort((a,b) => b.score - a.score);
  const topScore = sorted[0]?.score || 0;
  
  // If we have a dominant document, prefer chunks from it more strongly
  let filtered = [];
  if (dominantDocId && topScore > 0.3) {
    // Prefer dominant doc chunks, but allow others if they're very close in score
    const dominantChunks = sorted.filter(r => r.doc_id === dominantDocId);
    const otherChunks = sorted.filter(r => r.doc_id !== dominantDocId);
    // Take dominant doc chunks with score >= 0.3
    filtered.push(...dominantChunks.filter(r => r.score >= 0.3));
    // Only include other chunks if they're within 0.15 of top score (stricter)
    const otherThreshold = Math.max(0.3, topScore - 0.15);
    filtered.push(...otherChunks.filter(r => r.score >= otherThreshold));
  } else {
    // Standard filtering
    filtered = sorted.filter(r => r.score >= 0.3 && (topScore - r.score) <= 0.25);
  }
  
  // Remove duplicates and sort again
  filtered = [...new Map(filtered.map(r => [r.id, r])).values()].sort((a,b) => b.score - a.score);

  // Max Marginal Relevance selection with preference for dominant doc chunks
  const lambda = 0.7; // relevance vs diversity
  const selected = [];
  const pool = filtered;
  const sim = (a, b) => cosine(a.embedding, b.embedding);

  const take = (cand) => { selected.push(cand); };

  // Seed with best from dominant doc if available
  const dominantSeed = pool.find(r => r.doc_id === dominantDocId);
  if (dominantSeed) take(dominantSeed);

  while (selected.length < topK && pool.length) {
    let best = null; let bestMmr = -Infinity; let bestIdx = -1;
    for (let i = 0; i < pool.length; i++) {
      const r = pool[i];
      if (selected.includes(r)) continue;
      const maxSim = selected.length ? Math.max(...selected.map(s => sim(r, s))) : 0;
      const mmr = lambda * r.score - (1 - lambda) * maxSim;
      if (mmr > bestMmr) { bestMmr = mmr; best = r; bestIdx = i; }
    }
    if (best) {
      take(best);
      pool.splice(bestIdx, 1);
    } else {
      break;
    }
  }

  // Ensure we have a few from the dominant doc if query appears doc-specific
  if (dominantDocId && selected.filter(s => s.doc_id === dominantDocId).length < Math.ceil(topK/2)) {
    const addl = filtered.filter(r => r.doc_id === dominantDocId && !selected.includes(r))
      .slice(0, Math.ceil(topK/2) - selected.filter(s => s.doc_id === dominantDocId).length);
    for (const r of addl) if (selected.length < topK) selected.push(r);
  }

  const confidence = selected.length ? Math.max(0, Math.min(1, selected[0].score)) : 0;
  return { chunks: selected, confidence };
}

export function buildPrompt({ tenantName, queryText, chunks }) {
  const context = chunks.map(c => `- ${c.chunk.replace(/\s+/g,' ').slice(0,600)} (source: ${c.doc_id}, role_allowed: ${Array.isArray(c.allowed_roles)?c.allowed_roles.join(','): 'n/a'})`).join('\n');
  return {
    system: `You are an assistant for ${tenantName} HR system. You must answer using only the provided context. If the user request requires information outside the provided context, say you don't have permission or data and propose safe next steps.`,
    user: queryText,
    context
  };
}

export async function answerWithLLM({ system, user, context }) {
  const key = process.env.OPENAI_API_KEY || '';
  if (!key) {
    return { text: `No LLM configured. Context provided:\n${context.slice(0,1200)}`, model: 'none' };
  }
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: `Context:\n${context}\n\nUser question: ${user}\n\nInstructions: Use only context; if insufficient, say so and propose safe next steps. Include a short provenance list and a confidence score.` }
  ];
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: process.env.CHAT_MODEL || 'gpt-4o-mini', messages, temperature: 0 })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || 'LLM failed');
  return { text: data.choices?.[0]?.message?.content || '', model: data.model };
}

export function generateSafeSQLTemplate(nlIntent) {
  if (/employees on leave/i.test(nlIntent)) {
    return {
      template: `SELECT e.id, p.first_name, p.last_name, lr.start_date, lr.end_date
FROM leave_requests lr
JOIN employees e ON lr.employee_id = e.id
JOIN profiles p ON e.user_id = p.id
WHERE lr.tenant_id = $1 AND lr.start_date >= $2 AND lr.end_date <= $3;`,
      params: ['tenant_id','start_date','end_date'],
      requiresApproval: true
    };
  }
  return { template: '', params: [], requiresApproval: false };
}

export async function logAudit({ userId, tenantId, role, queryText, chunkIds, confidence }) {
  await db(
    `INSERT INTO rag_audit_logs (user_id, tenant_id, role, query, chunk_ids, confidence)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [userId, tenantId, role, queryText, chunkIds, confidence]
  );
}

export default { upsertDocument, retrieve, buildPrompt, answerWithLLM, generateSafeSQLTemplate, logAudit };




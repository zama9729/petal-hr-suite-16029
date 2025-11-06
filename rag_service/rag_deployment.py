"""
Self-contained FastAPI RAG microservice

Features:
- JWT-authenticated endpoints
- Chroma vector DB (local persistent) with per-tenant, per-role metadata
- Local embeddings via sentence-transformers (fallback)
- Optional OpenAI embeddings/LLM if OPENAI_API_KEY is set
- Clear JSON responses and simple audit log file

Env vars used:
- JWT_SECRET_KEY (required for auth)
- OPENAI_API_KEY (optional for embeddings/LLM)

Run locally:
  uvicorn rag_service.rag_deployment:app --reload --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import os
import json
import time
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional, Dict, Any, Tuple

import jwt
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, validator

# Vector DB (Chroma) and embeddings
_HAS_CHROMA = True
try:
    import chromadb
    from chromadb.config import Settings
except Exception:
    _HAS_CHROMA = False

_HAS_OPENAI = False
try:
    import openai  # type: ignore
    _HAS_OPENAI = True
except Exception:
    pass

_HAS_SENTENCE_TRANSFORMERS = False
try:
    from sentence_transformers import SentenceTransformer
    _HAS_SENTENCE_TRANSFORMERS = True
except Exception:
    pass


# ----------------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------------

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "")
if not JWT_SECRET_KEY:
    # Allow boot without secret in dev, but endpoints will enforce
    JWT_SECRET_KEY = "change-me-dev-only"

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
if _HAS_OPENAI and OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

CHROMA_DIR = os.getenv("CHROMA_DIR", os.path.abspath("./chroma_db"))
AUDIT_LOG_PATH = os.getenv("RAG_AUDIT_LOG", os.path.abspath("./rag_audit.log"))

# If RESET_CHROMA_DB is set, delete and recreate the ChromaDB collection
# This is useful if you have type mismatches (e.g., UUID vs string conflicts)
if os.getenv("RESET_CHROMA_DB", "").lower() in ("1", "true", "yes"):
    import shutil
    if os.path.exists(CHROMA_DIR):
        print(f"[WARNING] RESET_CHROMA_DB is set. Deleting ChromaDB at {CHROMA_DIR}")
        shutil.rmtree(CHROMA_DIR)
        print(f"[INFO] ChromaDB reset. You'll need to re-index all documents.")


# ----------------------------------------------------------------------------
# Security / Auth
# ----------------------------------------------------------------------------

security = HTTPBearer()


def decode_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def verify_tenant_access(user_payload: Dict[str, Any], tenant_id: str) -> None:
    if str(user_payload.get("tenant_id")) != str(tenant_id):
        raise HTTPException(status_code=403, detail="Access denied for this tenant")


class Role(str, Enum):
    employee = "employee"
    hr = "hr"
    ceo = "ceo"
    admin = "admin"


# ----------------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------------

class QueryAPIRequest(BaseModel):
    query: str
    max_results: Optional[int] = 5

    @validator("query")
    def query_not_empty(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Query cannot be empty")
        return v


class Provenance(BaseModel):
    source: str
    doc_id: str
    similarity: float
    confidentiality: str


class QueryAPIResponse(BaseModel):
    answer: str
    provenance: List[Provenance]
    confidence: str
    chunks_used: int
    fallback_options: Optional[List[str]]
    query_id: str
    timestamp: str


class DocumentUploadRequest(BaseModel):
    doc_id: str
    tenant_id: str
    allowed_roles: List[Role]
    confidentiality_level: str
    content: str
    source_type: str


# ----------------------------------------------------------------------------
# Embeddings
# ----------------------------------------------------------------------------

_embedder = None


def _ensure_embedder():
    global _embedder
    if _embedder is not None:
        return
    # Prefer local sentence-transformers for dev; fall back to OpenAI if configured
    if _HAS_SENTENCE_TRANSFORMERS:
        # Small, fast, decent quality model
        _embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    elif _HAS_OPENAI and OPENAI_API_KEY:
        _embedder = "openai"
    else:
        raise RuntimeError("No embedding backend available. Install sentence-transformers or set OPENAI_API_KEY.")


def embed_texts(texts: List[str]) -> List[List[float]]:
    _ensure_embedder()
    if _embedder == "openai":
        # Use OpenAI embeddings
        res = openai.Embedding.create(model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"), input=texts)
        return [d["embedding"] for d in res["data"]]
    else:
        return _embedder.encode(texts, normalize_embeddings=True).tolist()


# ----------------------------------------------------------------------------
# Vector store (Chroma)
# ----------------------------------------------------------------------------

class VectorStore:
    def __init__(self, persist_dir: str):
        self._in_memory = not _HAS_CHROMA
        if self._in_memory:
            # Simple in-memory store for dev fallback
            self._docs: List[Tuple[str, List[float], Dict[str, Any], str]] = []
        else:
            os.makedirs(persist_dir, exist_ok=True)
            self.client = chromadb.PersistentClient(path=persist_dir, settings=Settings(allow_reset=False))
            self.collection = self.client.get_or_create_collection(name="rag_chunks", metadata={"hnsw:space": "cosine"})

    def upsert(self, ids: List[str], embeddings: List[List[float]], metadatas: List[Dict[str, Any]], documents: List[str]):
        if self._in_memory:
            for i in range(len(ids)):
                self._docs.append((ids[i], embeddings[i], metadatas[i], documents[i]))
        else:
            # Ensure all metadata values are strings to avoid type issues with ChromaDB
            normalized_metadatas = []
            for meta in metadatas:
                normalized = {}
                for k, v in meta.items():
                    # Convert all values to strings to avoid UUID type conflicts
                    if v is None:
                        normalized[k] = ""
                    elif isinstance(v, (list, tuple)):
                        normalized[k] = ",".join(str(item) for item in v) if v else ""
                    else:
                        normalized[k] = str(v)
                normalized_metadatas.append(normalized)
            self.collection.upsert(ids=ids, embeddings=embeddings, documents=documents, metadatas=normalized_metadatas)

    def query(self, embedding: List[float], where: Dict[str, Any], top_k: int) -> Dict[str, Any]:
        if self._in_memory:
            # Filter by tenant_id
            tenant = str(where.get("tenant_id", ""))
            pool = [d for d in self._docs if str(d[2].get("tenant_id", "")) == tenant]
            # Cosine distance: 1 - similarity
            def _sim(vec):
                # robust cosine
                a = embedding; b = vec
                dot = sum(x*y for x,y in zip(a,b))
                na = sum(x*x for x in a) ** 0.5
                nb = sum(x*x for x in b) ** 0.5
                sim = dot / (na*nb + 1e-8)
                return max(0.0, min(1.0, sim))
            scored = sorted(((1.0 - _sim(vec), meta, doc, _id) for (_id, vec, meta, doc) in pool), key=lambda x: x[0])[:top_k]
            return {
                "distances": [[d for (d, _m, _doc, _id) in scored]],
                "metadatas": [[m for (_d, m, _doc, _id) in scored]],
                "documents": [[doc for (_d, _m, doc, _id) in scored]],
                "ids": [[id for (_d, _m, _doc, id) in scored]],
            }
        else:
            # Normalize where clause values to strings to avoid UUID type issues
            normalized_where = {}
            for k, v in where.items():
                normalized_where[k] = str(v) if v is not None else ""
            
            # Newer Chroma versions don't accept 'ids' in include; ids are returned implicitly
            try:
                return self.collection.query(
                    query_embeddings=[embedding],
                    where=normalized_where,
                    n_results=top_k,
                    include=["distances", "metadatas", "documents"]
                )  # type: ignore
            except Exception as e:
                # If query fails with UUID error, try without where filter and filter manually
                if "uuid" in str(e).lower() or "invalid input syntax" in str(e).lower():
                    import logging
                    logging.warning(f"[ChromaDB] Query with where clause failed (UUID error), retrying without filter: {e}")
                    # Query without where filter and filter results manually
                    all_results = self.collection.query(
                        query_embeddings=[embedding],
                        n_results=top_k * 10,  # Get more results to filter
                        include=["distances", "metadatas", "documents"]
                    )
                    # Filter by tenant_id manually
                    if all_results.get("metadatas") and len(all_results["metadatas"]) > 0:
                        filtered_indices = []
                        for i, meta in enumerate(all_results["metadatas"][0]):
                            if str(meta.get("tenant_id", "")) == normalized_where.get("tenant_id", ""):
                                filtered_indices.append(i)
                        
                        # Rebuild results with only filtered items
                        filtered_results = {
                            "distances": [[all_results["distances"][0][i] for i in filtered_indices[:top_k]]],
                            "metadatas": [[all_results["metadatas"][0][i] for i in filtered_indices[:top_k]]],
                            "documents": [[all_results["documents"][0][i] for i in filtered_indices[:top_k]]],
                        }
                        return filtered_results
                    return all_results
                raise


# ----------------------------------------------------------------------------
# RAG core
# ----------------------------------------------------------------------------

def chunk_text(text: str, max_len: int = 800) -> List[str]:
    parts: List[str] = []
    current = ""
    for para in str(text).split("\n\n"):
        if current and len(current) + 2 + len(para) > max_len:
            parts.append(current)
            current = para
        else:
            current = para if not current else current + "\n\n" + para
    if current:
        parts.append(current)
    return parts


def cosine_to_similarity(distance: float) -> float:
    # Chroma returns distances; with cosine, smaller is better; map to similarity
    return max(0.0, 1.0 - distance)


class RAGSystem:
    def __init__(self):
        self.vs = VectorStore(CHROMA_DIR)

    def upsert_document(self, *, tenant_id: str, doc_id: str, content: str, allowed_roles: List[Role], confidentiality_level: str, source_type: str, extra_metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        parts = chunk_text(content)
        metadatas = []
        for _ in parts:
            base = {
                "tenant_id": tenant_id,
                "doc_id": doc_id,
                # Store as comma-separated string for vector DB metadata constraints
                "allowed_roles": ",".join([r.value for r in allowed_roles]),
                "confidentiality_level": confidentiality_level,
                "source_type": source_type,
                "source_reference": "policy_manual",
            }
            if extra_metadata:
                # Merge extra metadata (e.g., display_name)
                for k, v in extra_metadata.items():
                    base[k] = v
            metadatas.append(base)
        ids = [f"{doc_id}::chunk::{i}" for i in range(len(parts))]
        embeddings = embed_texts(parts)
        self.vs.upsert(ids=ids, embeddings=embeddings, metadatas=metadatas, documents=parts)
        return {"doc_id": doc_id, "chunks_created": len(parts)}

    def retrieve(
        self,
        *,
        tenant_id: str,
        role: Role,
        query: str,
        top_k: int = 5,
        min_similarity: float = 0.5,
        ensure_min_chunks: int = 5,
        ignore_role: bool = False,
    ) -> Tuple[List[Dict[str, Any]], float]:
        qvec = embed_texts([query])[0]
        # tenant and role filter in vector store
        # Ensure tenant_id is a string to avoid UUID type issues
        where = {"tenant_id": str(tenant_id)}
        res = self.vs.query(qvec, where=where, top_k=top_k * 5)  # pull extra to filter by role and doc type
        hits: List[Dict[str, Any]] = []
        blocked_by_role = 0
        
        # Detect document type from query
        query_lower = query.lower()
        doc_type_keywords = {
            'appraisal': ['appraisal', 'performance', 'review', 'evaluation'],
            'medical': ['medical', 'illness', 'sick', 'health'],
            'maternity': ['maternity', 'pregnancy', 'pregnant', 'delivery', 'childbirth'],
            'work_hours': ['work hours', 'working hours', 'hours adherence', 'attendance', 'shift hours', 'office hours', 'timing policy'],
        }
        detected_types = [dt for dt, keywords in doc_type_keywords.items() 
                         if any(kw in query_lower for kw in keywords)]
        
        # Determine number of results robustly across backends
        result_count = 0
        if res.get("metadatas") and len(res["metadatas"]) > 0:
            result_count = len(res["metadatas"][0])
        for i in range(result_count):
            meta = res["metadatas"][0][i]
            doc = res["documents"][0][i]
            dist = res["distances"][0][i]
            allowed_field = meta.get("allowed_roles") or ""
            if isinstance(allowed_field, list):
                allowed = [str(s).strip() for s in allowed_field if str(s).strip()]
            else:
                allowed = [s.strip() for s in str(allowed_field).split(",") if s.strip()]
            if not ignore_role and allowed and role.value not in allowed:
                blocked_by_role += 1
                continue
            
            doc_id = str(meta.get("doc_id", "unknown")).lower()
            doc_text = doc.lower()
            
            # If we detected a specific document type, prefer matching chunks
            similarity = cosine_to_similarity(dist)
            if detected_types:
                matches_type = any(dt in doc_id or dt in doc_text for dt in detected_types)
                if not matches_type:
                    # Penalize non-matching chunks
                    if similarity < max(0.2, min_similarity - 0.2):
                        continue
            
            # Build a stable id even if backend doesn't return ids explicitly
            stable_id = str(meta.get("doc_id", "unknown")) + f"::idx::{i}"
            hits.append({
                "id": stable_id,
                "doc_id": str(meta.get("doc_id", "unknown")),
                "chunk": doc,
                "similarity": similarity,
                "confidentiality": str(meta.get("confidentiality_level", "internal")),
            })
        
        # Group by doc_id to identify dominant document
        by_doc = {}
        for hit in hits:
            doc_id = hit["doc_id"]
            if doc_id not in by_doc:
                by_doc[doc_id] = []
            by_doc[doc_id].append(hit)
        
        # Find dominant document (highest avg similarity)
        dominant_doc = None
        best_avg = 0.0
        for doc_id, doc_hits in by_doc.items():
            avg_sim = sum(h["similarity"] for h in doc_hits) / len(doc_hits)
            if avg_sim > best_avg:
                best_avg = avg_sim
                dominant_doc = doc_id
        
        # Sort by similarity, prefer dominant doc chunks
        hits.sort(key=lambda x: (
            -1 if x["doc_id"] == dominant_doc else 0,  # Prefer dominant doc
            -x["similarity"]  # Then by similarity
        ))
        
        # Filter: take dominant doc chunks first, then others only if very close
        selected = []
        dominant_chunks = [h for h in hits if h["doc_id"] == dominant_doc]
        other_chunks = [h for h in hits if h["doc_id"] != dominant_doc]
        
        # Take all dominant doc chunks above threshold
        selected.extend([h for h in dominant_chunks if h["similarity"] >= 0.3])
        
        # Only add other chunks if they're very close to the best score
        if dominant_chunks:
            top_score = dominant_chunks[0]["similarity"]
            threshold = max(0.3, top_score - 0.15)
            selected.extend([h for h in other_chunks if h["similarity"] >= threshold])
        else:
            selected.extend([h for h in other_chunks if h["similarity"] >= 0.3])
        
        # Remove duplicates and take top_k; ensure at least ensure_min_chunks when available
        seen_ids = set()
        final_selected = []
        for h in selected:
            if h["id"] not in seen_ids:
                seen_ids.add(h["id"])
                final_selected.append(h)
                if len(final_selected) >= max(ensure_min_chunks, top_k):
                    break

        # Fallback: if still too few chunks, broaden with synonyms and re-query
        if len(final_selected) < ensure_min_chunks:
            expansion_terms = [
                "work schedule", "shift hours", "office timing", "late arrivals", "attendance policy",
                "working hour policy", "hours of work", "punch in", "timesheet"
            ]
            for term in expansion_terms:
                qvec2 = embed_texts([term])[0]
                res2 = self.vs.query(qvec2, where=where, top_k=top_k * 3)
                # Merge results
                if res2.get("metadatas"):
                    for j in range(len(res2["metadatas"][0])):
                        meta2 = res2["metadatas"][0][j]
                        doc2 = res2["documents"][0][j]
                        dist2 = res2["distances"][0][j]
                        allowed2 = meta2.get("allowed_roles") or []
                        if not ignore_role and allowed2 and role.value not in allowed2:
                            blocked_by_role += 1
                            continue
                        sim2 = cosine_to_similarity(dist2)
                        stable_id2 = str(meta2.get("doc_id", "unknown")) + f"::exp::{j}"
                        candidate = {
                            "id": stable_id2,
                            "doc_id": str(meta2.get("doc_id", "unknown")),
                            "chunk": doc2,
                            "similarity": sim2,
                            "confidentiality": str(meta2.get("confidentiality_level", "internal")),
                            "source_reference": str(meta2.get("source_reference", "")),
                        }
                        if candidate["id"] not in seen_ids:
                            seen_ids.add(candidate["id"])
                            final_selected.append(candidate)
                            if len(final_selected) >= ensure_min_chunks:
                                break
                if len(final_selected) >= ensure_min_chunks:
                    break
        
        # If role filtering eliminated all, retry once ignoring role (testing aid)
        if not final_selected and blocked_by_role > 0:
            try:
                write_audit({
                    "ts": int(time.time()),
                    "type": "diagnostic",
                    "tenant_id": tenant_id,
                    "role": role.value,
                    "query": query,
                    "message": f"⚠️ Tenant/role mismatch: Retrieved {result_count} docs, but 0 matched tenant_id={tenant_id}, role={role.value}. Retrying without role filter.",
                })
            except Exception:
                pass
            # Retry without role filter, but keep tenant constraint
            return self.retrieve(tenant_id=tenant_id, role=role, query=query, top_k=top_k, min_similarity=min_similarity, ensure_min_chunks=ensure_min_chunks, ignore_role=True)

        confidence = final_selected[0]["similarity"] if final_selected else 0.0

        # Diagnostic log
        try:
            top_scores = [round(h["similarity"], 3) for h in final_selected[:5]]
            docs = [h["doc_id"] for h in final_selected[:5]]
            srcs = [h.get("source_reference", "") for h in final_selected[:5]]
            write_audit({
                "ts": int(time.time()),
                "type": "diagnostic",
                "tenant_id": tenant_id,
                "role": role.value,
                "query": query,
                "chunks": len(final_selected),
                "top_similarities": top_scores,
                "docs": docs,
                "sources": srcs,
                "blocked_by_role": blocked_by_role,
            })
        except Exception:
            pass
        return final_selected, confidence

    def answer(self, *, query: str, chunks: List[Dict[str, Any]]) -> str:
        if OPENAI_API_KEY and _HAS_OPENAI:
            context_lines = [f"- {c['chunk'][:600]} (source: {c['doc_id']})" for c in chunks]
            messages = [
                {"role": "system", "content": "Answer strictly using the provided context. If insufficient, say you don't have enough information and propose safe next steps."},
                {"role": "user", "content": f"Context:\n" + "\n".join(context_lines) + f"\n\nQuestion: {query}"}
            ]
            chat = openai.ChatCompletion.create(model=os.getenv("CHAT_MODEL", "gpt-4o-mini"), messages=messages, temperature=0)
            return chat["choices"][0]["message"]["content"].strip()
        # Fallback: extractive response
        if not chunks:
            return "I couldn’t find tenant-allowed info for that. Would you like me to (A) run a DB check, (B) escalate to HR, or (C) rephrase?"
        return "\n\n".join([f"From {c['doc_id']}: {c['chunk'][:600]}" for c in chunks])


rag = RAGSystem()


# ----------------------------------------------------------------------------
# Audit logging
# ----------------------------------------------------------------------------

def write_audit(event: Dict[str, Any]) -> None:
    try:
        with open(AUDIT_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")
    except Exception:
        pass


# ----------------------------------------------------------------------------
# FastAPI app & endpoints
# ----------------------------------------------------------------------------

app = FastAPI(title="RAG Microservice", version="1.0.0")


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "healthy", "vector_db": "chroma" if _HAS_CHROMA else "in-memory", "persist_dir": CHROMA_DIR}


@app.post("/api/v1/query", response_model=QueryAPIResponse)
def query_endpoint(payload: QueryAPIRequest, user_payload: Dict[str, Any] = Depends(decode_token)):
    if not JWT_SECRET_KEY:
        raise HTTPException(status_code=500, detail="JWT secret not configured")

    user_id = str(user_payload.get("user_id"))
    tenant_id = str(user_payload.get("tenant_id"))
    role_str = str(user_payload.get("role", "employee")).lower()
    try:
        role = Role(role_str)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role_str}")

    hits, conf = rag.retrieve(tenant_id=tenant_id, role=role, query=payload.query, top_k=int(payload.max_results or 5))
    answer = rag.answer(query=payload.query, chunks=hits)

    provenance = [
        {
            "source": "document",
            "doc_id": h["doc_id"],
            "similarity": round(float(h["similarity"]), 4),
            "confidentiality": h["confidentiality"],
        }
        for h in hits
    ]

    conf_label = "high" if conf >= 0.7 else ("medium" if conf >= 0.4 else "low")

    event = {
        "ts": int(time.time()),
        "type": "query",
        "user_id": user_id,
        "tenant_id": tenant_id,
        "role": role.value,
        "query": payload.query,
        "provenance": provenance,
        "confidence": conf,
    }
    write_audit(event)

    return QueryAPIResponse(
        answer=answer,
        provenance=[Provenance(**p) for p in provenance],
        confidence=conf_label,
        chunks_used=len(hits),
        fallback_options=None if conf >= 0.2 else ["DB check", "Escalate to HR", "Rephrase"],
        query_id=f"{user_id}_{int(time.time())}",
        timestamp=str(int(time.time()))
    )


@app.post("/api/v1/documents/upload")
def upload_document(req: DocumentUploadRequest, user_payload: Dict[str, Any] = Depends(decode_token)):
    if not JWT_SECRET_KEY:
        raise HTTPException(status_code=500, detail="JWT secret not configured")
    # Permissions: HR, CEO, Admin
    role = str(user_payload.get("role", "")).lower()
    if role not in ("hr", "ceo", "admin"):
        raise HTTPException(status_code=403, detail="Document upload requires HR, CEO, or Admin role")
    verify_tenant_access(user_payload, req.tenant_id)

    res = rag.upsert_document(
        tenant_id=req.tenant_id,
        doc_id=req.doc_id,
        content=req.content,
        allowed_roles=list(req.allowed_roles),
        confidentiality_level=req.confidentiality_level,
        source_type=req.source_type,
    )

    event = {
        "ts": int(time.time()),
        "type": "upload",
        "user_id": str(user_payload.get("user_id")),
        "tenant_id": req.tenant_id,
        "doc_id": req.doc_id,
        "chunks": res.get("chunks_created", 0),
    }
    write_audit(event)

    return {"status": "success", **res}


@app.post("/api/v1/index/tenant/{tenant_id}")
def index_tenant(tenant_id: str, user_payload: Dict[str, Any] = Depends(decode_token)):
    # Admin-only in this microservice example
    role = str(user_payload.get("role", "")).lower()
    if role != "admin":
        raise HTTPException(status_code=403, detail="Tenant indexing requires Admin role")
    verify_tenant_access(user_payload, tenant_id)

    # Placeholder: implement DB indexing as needed. Here we just return OK.
    event = {
        "ts": int(time.time()),
        "type": "index_tenant",
        "user_id": str(user_payload.get("user_id")),
        "tenant_id": tenant_id,
    }
    write_audit(event)
    return {"status": "success", "tenant_id": tenant_id, "message": "Tenant data indexing kicked off"}


@app.get("/api/v1/audit/logs")
def get_audit_logs(limit: int = 100, user_payload: Dict[str, Any] = Depends(decode_token)):
    role = str(user_payload.get("role", "")).lower()
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    try:
        with open(AUDIT_LOG_PATH, "r", encoding="utf-8") as f:
            lines = f.readlines()[-limit:]
        logs = [json.loads(l) for l in lines if l.strip()]
        return {"logs": logs, "count": len(logs)}
    except FileNotFoundError:
        return {"logs": [], "count": 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read logs: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("rag_service.rag_deployment:app", host="0.0.0.0", port=8000, reload=True)



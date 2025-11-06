"""
Enhanced RAG with Tool Calling - FastAPI endpoint
"""
import json
import logging
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime

from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

try:
    # Try relative imports first (when running as module)
    from .rag_deployment import (
        RAGSystem, QueryAPIRequest, QueryAPIResponse, Provenance,
        decode_token, Role, rag, OPENAI_API_KEY, _HAS_OPENAI
    )
    from .tools import ToolRegistry, ToolExecutionContext, ToolExecutionError
except ImportError:
    # Fallback to absolute imports (when running directly)
    from rag_deployment import (
        RAGSystem, QueryAPIRequest, QueryAPIResponse, Provenance,
        decode_token, Role, rag, OPENAI_API_KEY, _HAS_OPENAI
    )
    from tools import ToolRegistry, ToolExecutionContext, ToolExecutionError

logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="RAG with Tools", version="1.0.0")

security = HTTPBearer()

# Dummy DB connector for tools (replace with actual PostgresConnector if needed)
class DummyDBConnector:
    """Placeholder DB connector"""
    pass

tool_registry = ToolRegistry(DummyDBConnector())


# Ingestion helper: index a policy text with correct metadata
def add_policy_to_index(text: str, doc_id: str, tenant_id: str, roles: list[str]):
    try:
        role_enums = [Role(r.lower()) if not isinstance(r, Role) else r for r in roles]
        res = rag.upsert_document(
            tenant_id=tenant_id,
            doc_id=doc_id,
            content=text,
            allowed_roles=role_enums,
            confidentiality_level="public",
            source_type="policy",
        )
        logger.info(f"[INGEST] Indexed {res.get('chunks_created')} chunks for {doc_id} tenant={tenant_id}")
        return res
    except Exception as e:
        logger.error(f"[INGEST] Failed to index {doc_id}: {e}")
        raise


class EnhancedQueryResponse(QueryAPIResponse):
    """Extended response with tool calling info"""
    tool_calls: Optional[List[Dict[str, Any]]] = None
    tool_results: Optional[List[Dict[str, Any]]] = None
    source: str = "python-rag-service-with-tools"
# ============================
# Ingestion API (JSON)
# ============================

class IngestRequest(BaseModel):
    text: str
    doc_id: str
    tenant_id: str
    allowed_roles: list[str]


def _chunk_with_langchain(text: str) -> list[str]:
    """Use LangChain splitter if available, otherwise fallback to simple splitter."""
    try:
        from langchain.text_splitter import RecursiveCharacterTextSplitter  # type: ignore
        splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
        return splitter.split_text(text)
    except Exception:
        # Fallback: simple paragraph-based chunking
        from .rag_deployment import chunk_text as _ct  # type: ignore
        try:
            return _ct(text, max_len=800)
        except Exception:
            from rag_deployment import chunk_text as _ct2  # type: ignore
            return _ct2(text, max_len=800)


@app.post("/api/v1/ingest")
def ingest_document(req: IngestRequest, user_payload: Dict[str, Any] = Depends(decode_token)):
    # Validate tenant and auth
    if not req.text or not req.doc_id or not req.tenant_id:
        raise HTTPException(status_code=400, detail="Missing required fields: text, doc_id, tenant_id")
    if not req.allowed_roles:
        raise HTTPException(status_code=400, detail="allowed_roles required")

    # Enforce tenant isolation
    token_tenant = str(user_payload.get("tenant_id", ""))
    if token_tenant and token_tenant != req.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied for this tenant")

    # Chunk text and ingest using shared vector store via rag.upsert_document
    try:
        chunks = _chunk_with_langchain(req.text)
        # Recombine chunks for our existing rag.upsert_document API
        combined = "\n\n".join(chunks)
        role_enums = []
        for r in req.allowed_roles:
            try:
                role_enums.append(Role(r.lower()))
            except Exception:
                raise HTTPException(status_code=400, detail=f"Invalid role: {r}")

        # Ensure doc_id is stored as TEXT (no UUID enforcement); keep friendly name in metadata
        original_doc_id = str(req.doc_id)
        resolved_doc_id = original_doc_id  # TEXT id

        # Log metadata intent
        logger.info(
            f"[INGEST] doc_id={resolved_doc_id} tenant_id={req.tenant_id} allowed_roles={req.allowed_roles} len(text)={len(req.text)}"
        )

        res = rag.upsert_document(
            tenant_id=req.tenant_id,
            doc_id=resolved_doc_id,
            content=combined,
            allowed_roles=role_enums,
            confidentiality_level="public",
            source_type="policy",
            extra_metadata={
                "display_name": original_doc_id,
                "source_reference": "policy_manual",
            }
        )

        # Audit log
        try:
            from .rag_deployment import write_audit as _audit  # type: ignore
        except Exception:
            from rag_deployment import write_audit as _audit  # type: ignore
        _audit({
            "ts": int(datetime.utcnow().timestamp()),
            "type": "ingest",
            "tenant_id": req.tenant_id,
            "doc_id": resolved_doc_id,
            "chunks_added": res.get("chunks_created", 0),
            "allowed_roles": req.allowed_roles,
        })

        return {"message": "✅ Policy successfully ingested", "chunks_added": res.get("chunks_created", 0), "doc_id": resolved_doc_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Embedding failed: {str(e)}")


@app.get("/api/v1/ingest/debug")
def list_indexed_docs(user_payload: Dict[str, Any] = Depends(decode_token)):
    """
    Debug endpoint to list all indexed documents for the current tenant.
    Also shows a sample query to test retrieval.
    """
    tenant_id = str(user_payload.get("tenant_id", ""))
    try:
        from .rag_deployment import embed_texts  # type: ignore
    except Exception:
        from rag_deployment import embed_texts  # type: ignore
    # Simple probe query
    vec = embed_texts(["work hours policy probe"])[0]
    res = rag.vs.query(vec, where={"tenant_id": tenant_id}, top_k=25)
    metas = res.get("metadatas", [[]])[0]
    # Return unique doc_ids
    doc_ids = []
    seen = set()
    for m in metas:
        did = str(m.get("doc_id", "unknown"))
        if did not in seen:
            seen.add(did)
            doc_ids.append({
                "doc_id": did,
                "tenant_id": m.get("tenant_id"),
                "allowed_roles": m.get("allowed_roles"),
                "source_reference": m.get("source_reference"),
            })
    return {"docs": doc_ids, "count": len(doc_ids)}


@app.post("/api/v1/query", response_model=EnhancedQueryResponse)
async def query_with_tools(
    payload: QueryAPIRequest,
    user_payload: Dict[str, Any] = Depends(decode_token)
):
    """
    Query endpoint with tool calling support
    """
    if not _HAS_OPENAI or not OPENAI_API_KEY:
        # Fallback to basic RAG without tools
        return await _basic_rag_query(payload, user_payload)
    
    user_id = str(user_payload.get("user_id"))
    tenant_id = str(user_payload.get("tenant_id"))
    role_str = str(user_payload.get("role", "employee")).lower()
    
    assistant_message = None
    try:
        role = Role(role_str)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid role: {role_str}")
    
    # Step 1: Retrieve RAG context
    logger.info(f"[QUERY] tenant_id={tenant_id} role={role.value} query={payload.query}")
    hits, conf = rag.retrieve(
        tenant_id=tenant_id,
        role=role,
        query=payload.query,
        top_k=int(payload.max_results or 5)
    )
    
    # Log retrieval results for debugging
    if not hits:
        logger.warning(f"[QUERY] No chunks retrieved for tenant_id={tenant_id} role={role.value} query={payload.query}")
    else:
        logger.info(f"[QUERY] Retrieved {len(hits)} chunks: {[h.get('doc_id') for h in hits[:3]]}")
    
    # Step 2: Build context string
    context_lines = [f"- {c['chunk'][:600]} (source: {c['doc_id']})" for c in hits]
    context = "\n".join(context_lines) if context_lines else "No relevant context found."
    
    # Step 3: Get available tools for role
    available_tools = tool_registry.get_openai_tools_schema(role)
    
    # Step 4: Build system prompt
    system_prompt = f"""You are an AI assistant for tenant {tenant_id}'s HR & Payroll system.

You have access to two types of information:
1. **Document Context**: Retrieved from company documents, policies, and knowledge base
2. **Tools/Functions**: Live data access functions for real-time information

DECISION FRAMEWORK:
- Use **document context** for: policies, procedures, general guidelines, company information
- Use **tools** for: specific employee data, current balances, real-time stats, submitting requests

CRITICAL RULES:
1. If the user asks about their specific data (leave balance, payroll, etc.), prefer using tools over context
2. If asking for current/real-time information, use tools
3. For policy questions, use the provided context
4. Always cite sources when using context
5. Never fabricate data - if tools return errors, explain clearly
6. Respect the user's role: {role.value}

When using tools, explain what you're checking and why."""
    
    # Step 5: Build messages (ensure retrieved context is actually passed)
    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": f"""User Query: {payload.query}

Available Document Context:
{context}

Please answer the user's query. Use the tools if you need real-time or specific employee data."""
        }
    ]
    
    # Step 6: Log diagnostics about retrieved chunks and the context sent to LLM
    try:
        from .rag_deployment import write_audit as _audit
    except ImportError:
        from rag_deployment import write_audit as _audit
    try:
        _audit({
            "ts": int(datetime.utcnow().timestamp()),
            "type": "llm_context",
            "tenant_id": tenant_id,
            "role": role.value,
            "query": payload.query,
            "chunks_used": len(hits),
            "top_docs": [h.get("doc_id") for h in hits[:5]],
            "top_sims": [round(float(h.get("similarity", 0)), 3) for h in hits[:5]],
            "context_preview": (context[:500] if context else ""),
        })
    except Exception:
        pass

    # Step 7: First LLM call with tools
    tool_calls_made = []
    tool_results = []
    final_answer = ""
    
    try:
        # Try new OpenAI SDK (v1.0+)
        try:
            from openai import OpenAI
            client = OpenAI(api_key=OPENAI_API_KEY)
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                tools=available_tools if available_tools else None,
                tool_choice="auto",
                temperature=0.3,
                max_tokens=800
            )
            assistant_message = response.choices[0].message
        except ImportError:
            # Fallback to old OpenAI SDK (v0.28)
            import openai
            openai.api_key = OPENAI_API_KEY
            response = openai.ChatCompletion.create(
                model="gpt-4o-mini",
                messages=messages,
                tools=available_tools if available_tools else None,
                tool_choice="auto",
                temperature=0.3,
                max_tokens=800
            )
        # Check if LLM wants to call tools
        if assistant_message and hasattr(assistant_message, 'tool_calls') and assistant_message.tool_calls:
            # Execute tool calls
            tool_context = ToolExecutionContext(
                user_id=user_id,
                tenant_id=tenant_id,
                role=role
            )
            
            for tool_call in assistant_message.tool_calls:
                tool_name = tool_call.function.name
                try:
                    arguments = json.loads(tool_call.function.arguments)
                except json.JSONDecodeError:
                    arguments = {}
                
                try:
                    result = tool_registry.execute_tool(
                        tool_name=tool_name,
                        arguments=arguments,
                        context=tool_context
                    )
                    
                    tool_calls_made.append({
                        "tool": tool_name,
                        "arguments": arguments,
                        "timestamp": datetime.utcnow().isoformat()
                    })
                    
                    tool_results.append({
                        "tool_call_id": tool_call.id,
                        "tool_name": tool_name,
                        "result": result
                    })
                    
                except ToolExecutionError as e:
                    logger.error(f"Tool execution failed: {e}")
                    tool_results.append({
                        "tool_call_id": tool_call.id,
                        "tool_name": tool_name,
                        "error": str(e)
                    })
            
            # Step 7: Second LLM call with tool results
            messages.append({
                "role": "assistant",
                "content": None,
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    }
                    for tc in assistant_message.tool_calls
                ]
            })
            
            # Add tool results
            for tool_result in tool_results:
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_result["tool_call_id"],
                    "name": tool_result["tool_name"],
                    "content": json.dumps(tool_result.get("result", tool_result.get("error")))
                })
            
            # Final LLM call
            try:
                from openai import OpenAI
                client = OpenAI(api_key=OPENAI_API_KEY)
                final_response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    temperature=0.3,
                    max_tokens=600
                )
                final_answer = final_response.choices[0].message.content
            except ImportError:
                import openai
                openai.api_key = OPENAI_API_KEY
                final_response = openai.ChatCompletion.create(
                    model="gpt-4o-mini",
                    messages=messages,
                    temperature=0.3,
                    max_tokens=600
                )
                final_answer = final_response.choices[0].message.content
        elif assistant_message and getattr(assistant_message, 'content', None):
            # No tool calls - use direct answer
            final_answer = assistant_message.content
            
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        # Fallback to basic RAG answer
        if len(hits) == 0:
            final_answer = (
                "No relevant policy information was found for this query after searching indexed documents. "
                "Please ensure your policy is uploaded and indexed correctly."
            )
        else:
            final_answer = rag.answer(query=payload.query, chunks=hits)
    
    if not final_answer:
        if len(hits) == 0:
            final_answer = (
                "No relevant policy information was found for this query after searching indexed documents. "
                "Please ensure your policy is uploaded and indexed correctly."
            )
        else:
            final_answer = rag.answer(query=payload.query, chunks=hits)
    
    # Build provenance
    provenance = [
        Provenance(
            source="document",
            doc_id=h["doc_id"],
            similarity=round(float(h["similarity"]), 4),
            confidentiality=h["confidentiality"]
        )
        for h in hits
    ]
    
    conf_label = "high" if conf >= 0.7 else ("medium" if conf >= 0.4 else "low")
    
    return EnhancedQueryResponse(
        answer=final_answer,
        provenance=provenance,
        confidence=conf_label,
        chunks_used=len(hits),
        fallback_options=None if conf >= 0.2 else ["DB check", "Escalate to HR", "Rephrase"],
        query_id=f"{user_id}_{int(datetime.utcnow().timestamp())}",
        timestamp=str(int(datetime.utcnow().timestamp())),
        tool_calls=tool_calls_made if tool_calls_made else None,
        tool_results=tool_results if tool_results else None,
        source="python-rag-service-with-tools"
    )


async def _basic_rag_query(
    payload: QueryAPIRequest,
    user_payload: Dict[str, Any]
) -> EnhancedQueryResponse:
    """Fallback to basic RAG without tools"""
    try:
        from .rag_deployment import query_endpoint
    except ImportError:
        from rag_deployment import query_endpoint
    
    # Reuse existing endpoint
    result = query_endpoint(payload, user_payload)
    return EnhancedQueryResponse(
        **result.dict(),
        tool_calls=None,
        tool_results=None,
        source="python-rag-service"
    )


@app.get("/health")
def health():
    """Health check"""
    return {
        "status": "healthy",
        "service": "rag-with-tools",
        "has_openai": _HAS_OPENAI and bool(OPENAI_API_KEY),
        "tools_available": len(tool_registry._tools)
    }


@app.get("/api/v1/debug/vector")
def check_vector_docs(q: str = "work hours", k: int = 3, user_payload: Dict[str, Any] = Depends(decode_token)):
    """Debug endpoint to verify documents exist in the vector store for this tenant"""
    try:
        tenant_id = str(user_payload.get("tenant_id"))
        from .rag_deployment import embed_texts  # type: ignore
    except ImportError:
        tenant_id = str(user_payload.get("tenant_id"))
        from rag_deployment import embed_texts  # type: ignore

    vec = embed_texts([q])[0]
    res = rag.vs.query(vec, where={"tenant_id": tenant_id}, top_k=int(k or 3))
    return res.get("metadatas", [[]])[0]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("rag_service.rag_with_tools:app", host="0.0.0.0", port=8001, reload=True)


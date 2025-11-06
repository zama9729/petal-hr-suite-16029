"""
Helper script to ingest policy documents into the Python RAG vector store.

Usage:
  python -m rag_service.ingest_documents --file work_hours_policy.txt --doc-id work_hours_policy --tenant tenant_1 --roles employee hr ceo
"""
from __future__ import annotations

import argparse
import os
from typing import List

from .rag_deployment import rag, Role


def add_policy_to_index(text: str, doc_id: str, tenant_id: str, roles: List[str]):
    role_enums = [Role(r.lower()) for r in roles]
    # Keep doc_id as TEXT; store friendly name in metadata
    res = rag.upsert_document(
        tenant_id=tenant_id,
        doc_id=str(doc_id),
        content=text,
        allowed_roles=role_enums,
        confidentiality_level="public",
        source_type="policy",
        extra_metadata={
            "display_name": str(doc_id),
            "source_reference": "policy_manual",
        }
    )
    print(f"✅ Indexed {res.get('chunks_created')} chunks for {doc_id} (tenant={tenant_id})")
    return res


def main():
    parser = argparse.ArgumentParser(description="Ingest a policy document into RAG")
    parser.add_argument("--file", required=True, help="Path to text file to ingest")
    parser.add_argument("--doc-id", required=True, help="Document ID to use")
    parser.add_argument("--tenant", required=True, help="Tenant ID")
    parser.add_argument("--roles", nargs="+", default=["employee", "hr", "ceo"], help="Allowed roles")
    args = parser.parse_args()

    if not os.path.exists(args.file):
        raise FileNotFoundError(args.file)

    with open(args.file, "r", encoding="utf-8") as f:
        text = f.read()

    add_policy_to_index(text=text, doc_id=args.doc_id, tenant_id=args.tenant, roles=args.roles)


if __name__ == "__main__":
    main()




"""Load synthetic Helion documents. Safe to run more than once."""

from __future__ import annotations

import argparse
import asyncio

from app.core.config import get_settings
from app.db.qdrant import close_qdrant_client, get_qdrant_client
from app.db.session import dispose_engine, get_session_factory, init_database
from app.seed.corpus import CORPUS
from app.services.ingestion.parser import ParsedDocument
from app.services.ingestion.pipeline import IngestionService


async def seed(*, force: bool = False) -> None:
    await init_database()
    get_qdrant_client()
    settings = get_settings()
    factory = get_session_factory()
    indexed = 0
    skipped = 0
    async with factory() as session:
        service = IngestionService(session, settings)
        for item in CORPUS:
            parsed = ParsedDocument(
                title=item["title"],
                content=item["content"],
                document_type=item["document_type"],
                component=item["component"],
                version=item["version"],
                source=item["source"],
                tags=item.get("tags") or [],
                filename=f"{item['id']}.md",
            )
            existing = await service.repo.get(item["id"])
            if (
                existing
                and existing.status == "indexed"
                and existing.content_hash == parsed.content_hash
                and not force
            ):
                skipped += 1
                continue
            if existing:
                await service.delete(item["id"])
            document = await service.ingest(
                parsed,
                document_id=item["id"],
                allow_duplicate=True,
            )
            print(f"{document.id:24} {document.status:10} chunks={document.chunk_count}")
            indexed += 1
    print(f"indexed={indexed} skipped={skipped} total={len(CORPUS)}")
    close_qdrant_client()
    await dispose_engine()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed synthetic Helion Bench documents.")
    parser.add_argument("--force", action="store_true", help="Reindex even if hashes match.")
    args = parser.parse_args()
    asyncio.run(seed(force=args.force))

"""Shared catalogs for the fictional Helion Wireless Lab.

These values are the allowed metadata enumerations. The UI and API both
use them so filters stay consistent with stored documents.
"""

from typing import Final

COMPONENTS: Final[tuple[str, ...]] = (
    "Sensing Pipeline",
    "Signal Processing",
    "Communications Interface",
    "Timing Synchronization",
    "Data Acquisition",
    "Verification Framework",
)

DOCUMENT_TYPES: Final[tuple[str, ...]] = (
    "requirement",
    "test_specification",
    "troubleshooting_guide",
    "build_notes",
    "failure_report",
    "component_documentation",
    "release_notes",
    "investigation_record",
)

INGESTION_STATUSES: Final[tuple[str, ...]] = (
    "pending",
    "processing",
    "indexed",
    "failed",
)

VECTOR_SIZE: Final[int] = 256
COLLECTION_NAME: Final[str] = "helion_chunks"
INSUFFICIENT_EVIDENCE: Final[str] = (
    "Insufficient evidence was found in the indexed engineering knowledge base "
    "to support a reliable conclusion."
)
SYNTHETIC_DISCLAIMER: Final[str] = (
    "SYNTHETIC DATA — fictional Helion Wireless Lab. Not from any real operator, "
    "vendor, or telecommunications network."
)

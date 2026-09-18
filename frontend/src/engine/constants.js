export const APP_NAME = "Helion Bench";
export const APP_VERSION = "0.3.0";

export const COMPONENTS = [
  "Sensing Pipeline",
  "Signal Processing",
  "Communications Interface",
  "Timing Synchronization",
  "Data Acquisition",
  "Verification Framework",
];

export const DOCUMENT_TYPES = [
  "requirement",
  "test_specification",
  "troubleshooting_guide",
  "build_notes",
  "failure_report",
  "component_documentation",
  "release_notes",
  "investigation_record",
];

export const VECTOR_SIZE = 256;
export const CHUNK_SIZE = 1200;
export const CHUNK_OVERLAP = 160;
export const DEFAULT_K = 8;
export const MAX_K = 20;
export const MAX_UPLOAD_BYTES = 2_000_000;
export const SCORE_FLOOR = 0.16;
export const STORE_KEY = "helion-bench-v1";

export const INSUFFICIENT_EVIDENCE =
  "Insufficient evidence was found in the indexed engineering knowledge base to support a reliable conclusion.";

export const SYNTHETIC_DISCLAIMER =
  "SYNTHETIC DATA — fictional Helion Wireless Lab. Not from any real operator, vendor, or telecommunications network.";

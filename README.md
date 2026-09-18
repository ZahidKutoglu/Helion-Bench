# Helion Bench

A **browser-only** engineering intelligence demo for a fictional wireless sensing and communications verification lab.

There is **no backend to deploy**. Ingestion, hashed embeddings, hybrid search, grounded answers, citation checks, and evaluation all run in the browser. Data stays in `localStorage` on the visitor’s machine.

All corpus content is **synthetic**. Nothing here comes from Ericsson, operator networks, or proprietary telecommunications systems.

---

## What it does

Verification work produces requirements, test specs, build notes, and failure reports. When TS-4410 fails on build B-104, the useful answer is the evidence — not an unconstrained chatbot.

Helion Bench:

1. Loads 14 synthetic lab documents on first visit
2. Chunks and indexes them in the browser
3. Searches with hashed n-gram vectors plus lexical overlap
4. Answers investigation questions only from retrieved chunks
5. Drops citations that are not in the retrieval set
6. Runs a small evaluation set and shows the computed metrics

The default “model” is a labeled development responder. It is not GPT. The embedder is hashed n-grams, not a neural semantic model.

---

## Local run

Requires Node 20+.

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

```bash
npm test
npm run build
```

Restore the original synthetic corpus from **Settings** if you uploaded files and want a clean demo.

---

## Deploy to Vercel

There is no `package.json` at the repo root. Use **one** of these. Do not mix them.

### Recommended

1. Vercel → Project → Settings → General → **Root Directory** = `frontend`
2. Clear any custom **Install Command** / **Build Command** / **Output Directory** overrides (they should be the Vite defaults: `npm install`, `npm run build`, `dist`)
3. Redeploy

If a previous deploy used `npm install --prefix frontend` while Root Directory was already `frontend`, npm looked for `frontend/frontend/package.json` and failed.

### Alternative (Root Directory left empty)

Leave Root Directory as the repository root. The root `vercel.json` runs `cd frontend && npm install` and `cd frontend && npm run build`.

No environment variables are required.

---

## Architecture (browser)

```text
React workspace
  → localStorage document store
  → chunking + hashed embeddings
  → hybrid search (vector cosine + token overlap)
  → development responder
  → citation validator
```

The `backend/` folder is a leftover Python/FastAPI implementation. **The Vercel demo does not use it.**

---

## Demo path for recruiters

1. Open Investigations
2. Ask: “Why did the timing synchronization test fail in build B-104?”
3. Read the labeled development answer and the evidence panel
4. Click a citation to open the source document
5. Run Evaluation and show Recall@k / citation validity from that run
6. Open System Status — every row is a real local check, not a fake dashboard

---

## Known limitations

- No remote LLM. Answers are assembled from retrieved sentences.
- Hashed embeddings are a development fallback, not production semantic search.
- Data is per-browser (`localStorage`), not shared across devices.
- No authentication. Do not paste confidential engineering files.
- Combined scores are ranking signals, not probabilities.

---

## Security

Uploads never leave the browser. There are no API keys in the frontend bundle. Retrieved document text is treated as untrusted data; the development responder only scores sentence overlap and cannot call tools.

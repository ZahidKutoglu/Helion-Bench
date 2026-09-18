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

This repo is a static Vite app. Point Vercel at the GitHub repo.

**Option A — import the whole repository**

- Framework: Vite
- The root `vercel.json` already sets:
  - install: `npm install --prefix frontend`
  - build: `npm run build --prefix frontend`
  - output: `frontend/dist`
  - SPA rewrite to `index.html`

**Option B — Root Directory = `frontend`**

Then Vercel uses `frontend/vercel.json`.

After deploy, open the Vercel URL. The synthetic corpus seeds automatically. No environment variables, API keys, Postgres, or Qdrant are required.

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

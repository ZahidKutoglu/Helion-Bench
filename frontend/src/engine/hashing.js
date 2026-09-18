import { VECTOR_SIZE } from "./constants";

const TOKEN = /[a-z0-9][a-z0-9_\-./]*/g;

export function tokenize(text) {
  return String(text || "").toLowerCase().match(TOKEN) || [];
}

function fnv1a(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function embedOne(text, dimensions = VECTOR_SIZE) {
  const tokens = tokenize(text);
  const grams = [...tokens];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    grams.push(`${tokens[i]}_${tokens[i + 1]}`);
  }
  const vec = new Array(dimensions).fill(0);
  if (!grams.length) return vec;
  for (const gram of grams) {
    const number = fnv1a(gram);
    const index = number % dimensions;
    const sign = (number >>> 20) & 1 ? -1 : 1;
    vec[index] += sign;
  }
  const norm = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vec.map((value) => value / norm);
}

export function cosine(a, b) {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) sum += a[i] * b[i];
  return sum;
}

export function contentHash(text) {
  const normalized = String(text || "")
    .trim()
    .split(/\n/)
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n");
  return fnv1a(normalized).toString(16).padStart(8, "0") + fnv1a(`:${normalized.length}`).toString(16);
}

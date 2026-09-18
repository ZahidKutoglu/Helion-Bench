const HEADING = /^(#{1,6})\s+(.*)$/;

export function chunkDocument(text, chunkSize = 1200, overlap = 160) {
  const cleaned = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];

  const packed = [];
  for (const [section, body] of splitSections(cleaned)) {
    for (const piece of pack(body, chunkSize, overlap)) {
      packed.push({ section, content: piece });
    }
  }

  return packed
    .filter((item) => item.content.trim())
    .map((item, ordinal) => ({ ordinal, section: item.section, content: item.content }));
}

function splitSections(text) {
  const lines = text.split("\n");
  const sections = [[null, []]];
  for (const line of lines) {
    const match = HEADING.exec(line);
    if (match) {
      sections.push([match[2].trim(), [line]]);
    } else {
      sections[sections.length - 1][1].push(line);
    }
  }
  const result = [];
  for (const [title, bodyLines] of sections) {
    const body = bodyLines.join("\n").trim();
    if (body) result.push([title, body]);
  }
  return result.length ? result : [[null, text]];
}

function pack(text, chunkSize, overlap) {
  if (text.length <= chunkSize) return [text];
  const paragraphs = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs.length ? paragraphs : [text]) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= chunkSize) {
      current = candidate;
      continue;
    }
    if (current) {
      chunks.push(current);
      current = overlapSuffix(current, overlap);
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      if (current.length > chunkSize) {
        const pieces = splitLong(current, chunkSize, overlap);
        chunks.push(...pieces);
        current = overlapSuffix(chunks[chunks.length - 1], overlap);
      }
    } else {
      const pieces = splitLong(paragraph, chunkSize, overlap);
      chunks.push(...pieces);
      current = overlapSuffix(pieces[pieces.length - 1], overlap);
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function splitLong(text, chunkSize, overlap) {
  const pieces = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(text.length, start + chunkSize);
    const piece = text.slice(start, end).trim();
    if (piece) pieces.push(piece);
    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
  }
  return pieces;
}

function overlapSuffix(text, overlap) {
  if (overlap <= 0 || text.length <= overlap) return text;
  return text.slice(-overlap).replace(/^\s+/, "");
}

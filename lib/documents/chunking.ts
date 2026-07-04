import { makeId } from "@/lib/utils/id";
import type { DocumentChunk } from "@/lib/types";

const CHUNK_SIZE = 4200;
const CHUNK_OVERLAP = 350;

export function chunkText(documentId: string, text: string): DocumentChunk[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
  if (!normalized) {
    return [];
  }

  const chunks: DocumentChunk[] = [];
  let cursor = 0;
  let index = 0;

  while (cursor < normalized.length) {
    const next = Math.min(cursor + CHUNK_SIZE, normalized.length);
    const slice = normalized.slice(cursor, next);
    const sectionTitle = inferSectionTitle(slice);
    chunks.push({
      id: makeId("chunk"),
      documentId,
      chunkIndex: index,
      text: slice.trim(),
      sectionTitle,
    });
    index += 1;
    cursor = next - CHUNK_OVERLAP;
    if (cursor < 0 || cursor >= normalized.length || next === normalized.length) {
      break;
    }
  }

  return chunks;
}

export function inferSectionTitle(text: string) {
  const markdownHeading = text.match(/^#{1,4}\s+(.+)$/m);
  if (markdownHeading?.[1]) {
    return markdownHeading[1].trim().slice(0, 120);
  }

  const firstLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && line.length < 100);
  if (firstLine) {
    return firstLine;
  }
  return null;
}

export function selectRelevantChunks(
  chunks: DocumentChunk[],
  question: string,
  limit = 5,
) {
  const terms = tokenize(question);
  if (terms.length === 0) {
    return chunks.slice(0, limit);
  }

  return [...chunks]
    .map((chunk) => ({
      chunk,
      score: scoreChunk(chunk.text, terms),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ chunk }) => chunk);
}

export function searchChunks(chunks: DocumentChunk[], query: string, limit = 20) {
  const terms = tokenize(query);
  if (terms.length === 0) {
    return [];
  }

  return chunks
    .map((chunk) => ({
      chunk,
      score: scoreChunk(chunk.text, terms),
      excerpt: makeExcerpt(chunk.text, terms[0] ?? query),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function buildContextBlock(chunks: DocumentChunk[]) {
  return chunks
    .map((chunk) => {
      const label = chunk.sectionTitle
        ? `Chunk ${chunk.chunkIndex + 1}: ${chunk.sectionTitle}`
        : `Chunk ${chunk.chunkIndex + 1}`;
      return `[${label}]\n${chunk.text}`;
    })
    .join("\n\n---\n\n");
}

function tokenize(input: string) {
  return input
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

function scoreChunk(text: string, terms: string[]) {
  const lower = text.toLowerCase();
  return terms.reduce((score, term) => {
    const matches = lower.split(term).length - 1;
    return score + matches * Math.min(term.length, 12);
  }, 0);
}

function makeExcerpt(text: string, term: string) {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(term.toLowerCase());
  const start = idx >= 0 ? Math.max(0, idx - 80) : 0;
  const end = Math.min(text.length, start + 220);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

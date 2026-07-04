import type { ChatMessage, DocumentChunk, DocumentRecord } from "@/lib/types";

export function buildChatTranscriptMarkdown({
  document,
  messages,
  chunks,
  exportedAt = new Date().toISOString(),
}: {
  document: DocumentRecord;
  messages: ChatMessage[];
  chunks: DocumentChunk[];
  exportedAt?: string;
}) {
  const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const lines = [
    `# AI Conversation - ${sanitizeHeading(document.title)}`,
    "",
    `- Document: ${document.title}`,
    `- Format: ${document.ext.toUpperCase()}`,
    `- Exported: ${exportedAt}`,
    `- Messages: ${messages.length}`,
    "",
    "## Conversation",
  ];

  for (const message of messages) {
    const role = message.role === "assistant" ? "AI" : "User";
    lines.push("", `### ${role}`, "", message.content.trim() || "_Empty message_");

    if (message.role === "assistant" && message.sourceChunkIds?.length) {
      const sources = message.sourceChunkIds
        .map((id) => chunkById.get(id))
        .filter((chunk): chunk is DocumentChunk => Boolean(chunk))
        .map((chunk) => {
          const label = `Chunk ${chunk.chunkIndex + 1}`;
          return chunk.sectionTitle?.trim() ? `${label}: ${chunk.sectionTitle.trim()}` : label;
        });

      if (sources.length > 0) {
        lines.push("", `Sources: ${dedupe(sources).join(", ")}`);
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

export function chatTranscriptFilename(title: string, exportedAt = new Date()) {
  const date = exportedAt.toISOString().slice(0, 10);
  const safeTitle = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "conversation";
  return `${safeTitle}-chat-${date}.md`;
}

function sanitizeHeading(value: string) {
  return value.replace(/\s+/g, " ").replace(/^#+\s*/, "").trim() || "Untitled Document";
}

function dedupe(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

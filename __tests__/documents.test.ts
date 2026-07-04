import { describe, expect, it } from "vitest";
import { buildChatTranscriptMarkdown, chatTranscriptFilename } from "@/lib/chat/export";
import { getExtension, validateImportAsset } from "@/lib/documents/assets";
import { shouldPreserveOriginalText } from "@/lib/documents/original";
import {
  buildContextBlock,
  chunkText,
  searchChunks,
  selectRelevantChunks,
} from "@/lib/documents/chunking";

describe("document assets", () => {
  it("extracts extensions case-insensitively", () => {
    expect(getExtension("Research.PDF")).toBe("pdf");
    expect(getExtension("notes.final.docx")).toBe("docx");
  });

  it("accepts supported document formats", () => {
    expect(
      validateImportAsset({
        uri: "file:///a.md",
        name: "a.md",
        size: 1024,
      }),
    ).toEqual({ ext: "md" });
  });

  it("rejects unsupported formats", () => {
    expect(() =>
      validateImportAsset({
        uri: "file:///image.png",
        name: "image.png",
        size: 1024,
      }),
    ).toThrow(/Unsupported file type/);
  });

  it("rejects files over 100 MB", () => {
    expect(() =>
      validateImportAsset({
        uri: "file:///large.pdf",
        name: "large.pdf",
        size: 101 * 1024 * 1024,
      }),
      ).toThrow(/larger than 100 MB/);
  });

  it("preserves original text only for text-native readers", () => {
    expect(shouldPreserveOriginalText("md")).toBe(true);
    expect(shouldPreserveOriginalText("txt")).toBe(true);
    expect(shouldPreserveOriginalText("pdf")).toBe(false);
    expect(shouldPreserveOriginalText("docx")).toBe(false);
  });
});

describe("document chunking and retrieval", () => {
  it("chunks text and infers markdown headings", () => {
    const chunks = chunkText("doc_1", "# Product Plan\n\nThe launch risk is budget.");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].sectionTitle).toBe("Product Plan");
  });

  it("leaves section title empty when no heading-like line exists", () => {
    const chunks = chunkText(
      "doc_1",
      "This extracted paragraph is intentionally long enough that it does not look like a short section heading, and it should not be shown as a table of contents title.",
    );
    expect(chunks[0].sectionTitle).toBeNull();
  });

  it("selects relevant chunks by query terms", () => {
    const chunks = chunkText(
      "doc_1",
      [
        "# Finance\nThe budget requires approval from leadership.",
        "# Design\nThe interface uses a mobile-first layout.",
      ].join("\n\n"),
    );
    const selected = selectRelevantChunks(chunks, "budget approval", 1);
    expect(selected[0].text).toContain("budget");
  });

  it("returns compact search excerpts", () => {
    const chunks = chunkText("doc_1", "Alpha beta gamma. The API key is configured in settings.");
    const results = searchChunks(chunks, "settings");
    expect(results[0].excerpt).toContain("settings");
  });

  it("builds context blocks with chunk labels", () => {
    const chunks = chunkText("doc_1", "# Scope\nA short document.");
    expect(buildContextBlock(chunks)).toContain("[Chunk 1: Scope]");
  });
});

describe("chat export", () => {
  it("builds a markdown transcript with sourced AI messages", () => {
    const markdown = buildChatTranscriptMarkdown({
      document: {
        id: "doc_1",
        title: "Launch Plan",
        ext: "md",
        mime: "text/markdown",
        status: "ready",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      chunks: [
        {
          id: "chunk_1",
          documentId: "doc_1",
          chunkIndex: 0,
          text: "Budget approval is the key risk.",
          sectionTitle: "Risks",
        },
      ],
      messages: [
        {
          id: "msg_1",
          documentId: "doc_1",
          role: "user",
          content: "What is the main risk?",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "msg_2",
          documentId: "doc_1",
          role: "assistant",
          content: "The main risk is budget approval.",
          sourceChunkIds: ["chunk_1"],
          createdAt: "2026-01-01T00:01:00.000Z",
        },
      ],
      exportedAt: "2026-01-01T00:02:00.000Z",
    });

    expect(markdown).toContain("# AI Conversation - Launch Plan");
    expect(markdown).toContain("### User");
    expect(markdown).toContain("### AI");
    expect(markdown).toContain("Sources: Chunk 1: Risks");
  });

  it("creates a safe markdown filename", () => {
    expect(chatTranscriptFilename("Launch Plan.pdf", new Date("2026-01-02T00:00:00Z"))).toBe(
      "launch-plan-pdf-chat-2026-01-02.md",
    );
  });
});

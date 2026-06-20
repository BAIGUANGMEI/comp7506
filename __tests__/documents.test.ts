import { describe, expect, it } from "vitest";
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

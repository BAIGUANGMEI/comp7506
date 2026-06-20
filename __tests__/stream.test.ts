import { describe, expect, it } from "vitest";
import { extractDeltaFromChatChunk, parseSseChunk } from "@/lib/ai/stream";

describe("SSE chat parser", () => {
  it("extracts data payloads", () => {
    expect(parseSseChunk("event: message\ndata: {\"ok\":true}\n\n")).toEqual([
      "{\"ok\":true}",
    ]);
  });

  it("extracts streaming deltas", () => {
    const payload = JSON.stringify({
      choices: [{ delta: { content: "Hello" } }],
    });
    expect(extractDeltaFromChatChunk(payload)).toEqual({ done: false, delta: "Hello" });
  });

  it("handles done marker", () => {
    expect(extractDeltaFromChatChunk("[DONE]")).toEqual({ done: true, delta: "" });
  });
});

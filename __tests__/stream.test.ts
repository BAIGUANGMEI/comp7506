import { describe, expect, it } from "vitest";
import { extractDeltaFromChatChunk, parseChatCompletionText, parseSseChunk } from "@/lib/ai/stream";

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

  it("accepts data-prefixed payloads", () => {
    const payload = JSON.stringify({
      choices: [{ delta: { content: "Hello" } }],
    });
    expect(extractDeltaFromChatChunk(`data: ${payload}`)).toEqual({
      done: false,
      delta: "Hello",
    });
  });

  it("parses buffered SSE responses", () => {
    const body = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Hel" } }] })}`,
      "",
      `data: ${JSON.stringify({ choices: [{ delta: { content: "lo" } }] })}`,
      "",
      "data: [DONE]",
      "",
    ].join("\n");

    expect(parseSseChunk(body)).toHaveLength(3);
    expect(parseChatCompletionText(body)).toBe("Hello");
  });

  it("handles done marker", () => {
    expect(extractDeltaFromChatChunk("[DONE]")).toEqual({ done: true, delta: "" });
  });
});

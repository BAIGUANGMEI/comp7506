export function parseSseChunk(raw: string) {
  const events: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) {
      continue;
    }
    events.push(trimmed.replace(/^data:\s*/, ""));
  }
  return events;
}

export function extractDeltaFromChatChunk(payload: string) {
  if (payload === "[DONE]") {
    return { done: true, delta: "" };
  }

  const json = JSON.parse(payload) as {
    choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
  };

  return {
    done: false,
    delta: json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content ?? "",
  };
}

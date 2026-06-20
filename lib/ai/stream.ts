export function parseSseChunk(raw: string) {
  const events: string[] = [];

  for (const block of raw.replace(/\r\n/g, "\n").split(/\n\n+/)) {
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) {
        continue;
      }
      dataLines.push(trimmed.replace(/^data:\s*/, ""));
    }

    if (dataLines.length > 0) {
      events.push(dataLines.join("\n").trim());
    }
  }

  return events;
}

export function extractDeltaFromChatChunk(payload: string) {
  const cleanPayload = payload.trim().replace(/^data:\s*/, "");

  if (cleanPayload === "[DONE]") {
    return { done: true, delta: "" };
  }

  const json = JSON.parse(cleanPayload) as {
    choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
  };

  return {
    done: false,
    delta: json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content ?? "",
  };
}

export function parseChatCompletionText(body: string) {
  const trimmed = body.trim();
  if (!trimmed) {
    return "";
  }

  const ssePayloads = parseSseChunk(trimmed);
  if (ssePayloads.length > 0) {
    let full = "";
    for (const payload of ssePayloads) {
      const result = extractDeltaFromChatChunk(payload);
      if (result.done) {
        break;
      }
      full += result.delta;
    }
    return full;
  }

  try {
    const json = JSON.parse(trimmed) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return json.choices?.[0]?.message?.content ?? "";
  } catch {
    throw new Error(`Could not parse AI response: ${trimmed.slice(0, 240)}`);
  }
}

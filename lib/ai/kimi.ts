import { Platform } from "react-native";
import { buildDocumentChatSystemPrompt } from "@/lib/ai/prompts";
import { buildContextBlock } from "@/lib/documents/chunking";
import { extractDeltaFromChatChunk, parseChatCompletionText, parseSseChunk } from "@/lib/ai/stream";
import type {
  AIMessage,
  AIProviderAdapter,
  DocumentChunk,
  DocumentRecord,
  ImportAsset,
  ProviderRuntimeConfig,
} from "@/lib/types";

export const kimiAdapter: AIProviderAdapter = {
  async uploadForExtraction(config, asset) {
    const formData = new FormData();
    formData.append("purpose", "file-extract");

    if (Platform.OS === "web" && asset.file) {
      formData.append("file", asset.file, asset.name);
    } else {
      formData.append("file", {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || "application/octet-stream",
      } as unknown as Blob);
    }

    const response = await fetch(endpoint(config, "/files"), {
      method: "POST",
      headers: authHeaders(config, true),
      body: formData,
    });
    await assertOk(response);
    return response.json();
  },

  async getExtractedContent(config, fileId) {
    const response = await fetch(endpoint(config, `/files/${fileId}/content`), {
      method: "GET",
      headers: authHeaders(config),
    });
    await assertOk(response);
    return response.text();
  },

  async deleteRemoteFile(config, fileId) {
    const response = await fetch(endpoint(config, `/files/${fileId}`), {
      method: "DELETE",
      headers: authHeaders(config),
    });
    if (response.status === 404) {
      return;
    }
    await assertOk(response);
  },

  async summarizeDocument(config, document, chunks) {
    const context = buildContextBlock(chunks.slice(0, 8));
    const messages: AIMessage[] = [
      {
        role: "system",
        content:
          "You are a careful document analysis assistant. Return concise English output with clear headings.",
      },
      {
        role: "user",
        content: `Analyze this document and return the following sections in English:

Overview: 2-3 sentences.
Key points: 5 bullets.
Visual content: describe any image, chart, table, screenshot, or scanned-page content mentioned in the extracted text. If none is present, say "No visual content was detected in the extraction."
Suggested questions: 4 useful questions the user can ask.

Document title: ${document.title}

${context}`,
      },
    ];

    const content = await createChatCompletion(config, messages, false);
    return {
      summary: content,
      visualSummary: extractVisualSection(content),
    };
  },

  async streamDocumentChat(config, messages, onDelta) {
    return createChatCompletion(config, messages, true, onDelta);
  },

  async testConnection(config) {
    await createChatCompletion(
      config,
      [{ role: "user", content: "Reply with: OK" }],
      false,
      undefined,
      64,
    );
  },
};

export function endpoint(config: ProviderRuntimeConfig, path: string) {
  return `${config.baseUrl.replace(/\/$/, "")}${path}`;
}

export function authHeaders(config: ProviderRuntimeConfig, formData = false) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
  };
  if (!formData) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

export function buildDocumentChatMessages(
  document: DocumentRecord,
  chunks: DocumentChunk[],
  history: Array<{ role: "user" | "assistant"; content: string }>,
  question: string,
  agentSystemPrompt?: string,
): AIMessage[] {
  const context = buildContextBlock(chunks);
  return [
    {
      role: "system",
      content: buildDocumentChatSystemPrompt(agentSystemPrompt),
    },
    {
      role: "system",
      content: `Document: ${document.title}\n\n${context}`,
    },
    ...history.slice(-8).map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: "user", content: question },
  ];
}

async function createChatCompletion(
  config: ProviderRuntimeConfig,
  messages: AIMessage[],
  stream: boolean,
  onDelta?: (delta: string) => void,
  maxCompletionTokens = 2048,
) {
  const response = await fetch(endpoint(config, "/chat/completions"), {
    method: "POST",
    headers: authHeaders(config),
    body: JSON.stringify({
      model: config.model,
      messages,
      stream,
      max_completion_tokens: maxCompletionTokens,
    }),
  });
  await assertOk(response);

  if (!stream || !response.body || !("getReader" in response.body)) {
    const content = parseChatCompletionText(await response.text());
    if (stream && content) {
      onDelta?.(content);
    }
    return content;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split(/\n\n/);
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      for (const payload of parseSseChunk(part)) {
        const result = extractDeltaFromChatChunk(payload);
        if (result.done) {
          return full;
        }
        if (result.delta) {
          full += result.delta;
          onDelta?.(result.delta);
        }
      }
    }
  }

  return full;
}

async function assertOk(response: Response) {
  if (response.ok) {
    return;
  }

  const body = await response.text().catch(() => "");
  throw new Error(
    formatApiError(response.status, response.statusText, body),
  );
}

function formatApiError(status: number, statusText: string, body: string) {
  let detail = body;
  try {
    const json = JSON.parse(body) as { error?: { message?: string; type?: string }; message?: string };
    detail = json.error?.message || json.message || body;
  } catch {
    // Keep the raw body.
  }

  const base = `API request failed (${status} ${statusText})`;
  if (status === 401) {
    return `${base}: API key is invalid or not authorized for this endpoint.`;
  }
  if (status === 403) {
    return `${base}: request was forbidden. Check the API key permissions or model access.`;
  }
  if (!detail) {
    return base;
  }
  return `${base}: ${detail.slice(0, 400)}`;
}

function extractVisualSection(content: string) {
  const match = content.match(/Visual content:\s*([\s\S]*?)(?:\n[A-Z][^:\n]+:|$)/i);
  return match?.[1]?.trim() || "No visual content was detected in the extraction.";
}

import { describe, expect, it } from "vitest";
import { buildDocumentChatSystemPrompt } from "@/lib/ai/prompts";
import { buildRuntimeConfig, normalizeProviderBaseUrl } from "@/lib/ai/provider";
import { authProviderLabel, buildAppleDisplayName } from "@/lib/auth/account";
import { DEFAULT_PROVIDER_CONFIG } from "@/config/defaults";

describe("provider runtime config", () => {
  it("adds /v1 when the base URL only contains an origin", () => {
    expect(normalizeProviderBaseUrl("https://api.moonshot.cn")).toBe(
      "https://api.moonshot.cn/v1",
    );
  });

  it("keeps an existing /v1 path", () => {
    expect(normalizeProviderBaseUrl("https://api.moonshot.cn/v1/")).toBe(
      "https://api.moonshot.cn/v1",
    );
  });

  it("requires an API key", () => {
    expect(() => buildRuntimeConfig(DEFAULT_PROVIDER_CONFIG, " ")).toThrow(/API key/);
  });

  it("builds a grounded prompt with custom agent instructions", () => {
    const prompt = buildDocumentChatSystemPrompt(
      "Respond like a concise product analyst.",
    );

    expect(prompt).toContain("Respond like a concise product analyst");
    expect(prompt).toContain("document-grounding rules");
  });

  it("formats auth account labels and Apple names", () => {
    expect(authProviderLabel("google")).toBe("Google");
    expect(authProviderLabel("apple")).toBe("Apple");
    expect(
      buildAppleDisplayName({
        givenName: "Ada",
        middleName: null,
        familyName: "Lovelace",
        nickname: null,
      }),
    ).toBe("Ada Lovelace");
  });
});

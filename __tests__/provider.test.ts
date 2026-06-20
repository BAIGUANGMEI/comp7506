import { describe, expect, it } from "vitest";
import { buildRuntimeConfig, normalizeProviderBaseUrl } from "@/lib/ai/provider";
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
});

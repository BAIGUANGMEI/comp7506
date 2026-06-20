import type { ProviderConfig, ProviderRuntimeConfig } from "@/lib/types";

export function normalizeProviderBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Base URL is required.");
  }

  const url = new URL(trimmed);
  url.hash = "";
  url.search = "";

  const pathname = url.pathname.replace(/\/+$/, "");
  if (!pathname) {
    url.pathname = "/v1";
  } else {
    url.pathname = pathname;
  }

  return url.toString().replace(/\/$/, "");
}

export function buildRuntimeConfig(
  config: ProviderConfig,
  apiKey: string,
): ProviderRuntimeConfig {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Add your API key in Settings before using AI features.");
  }

  return {
    ...config,
    baseUrl: normalizeProviderBaseUrl(config.baseUrl),
    apiKey: trimmedKey,
  };
}

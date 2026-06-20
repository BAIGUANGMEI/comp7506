import type { ProviderConfig } from "@/lib/types";

export const API_KEY_REF = "document-ai-provider-api-key";

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  baseUrl: "https://api.moonshot.cn/v1",
  model: "kimi-k2.6",
  apiKeyRef: API_KEY_REF,
  deleteRemoteFilesAfterExtraction: true,
};

export const MAX_IMPORT_BYTES = 100 * 1024 * 1024;

export const SUPPORTED_EXTENSIONS = ["txt", "md", "pdf", "doc", "docx"] as const;

export const SUPPORTED_MIME_TYPES = [
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

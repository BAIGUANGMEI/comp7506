import type { AgentConfig, AuthConfig, ProviderConfig, UserProfile } from "@/lib/types";

function publicEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

export const API_KEY_REF = "document-ai-provider-api-key";

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  baseUrl: "https://api.moonshot.cn/v1",
  model: "kimi-k2.6",
  apiKeyRef: API_KEY_REF,
  deleteRemoteFilesAfterExtraction: true,
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  displayName: "User",
  avatarDataUri: null,
};

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  systemPrompt:
    "You are a careful document research assistant. Answer clearly, stay grounded in the selected document, cite relevant chunks when useful, and say when the document does not contain enough information.",
};

export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  googleWebClientId: publicEnv("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"),
  googleIosClientId: publicEnv("EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"),
  googleAndroidClientId: publicEnv("EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID"),
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

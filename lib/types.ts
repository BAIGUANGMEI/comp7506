export type DocumentStatus =
  | "queued"
  | "uploading"
  | "extracting"
  | "summarizing"
  | "ready"
  | "failed";

export type ProviderConfig = {
  baseUrl: string;
  model: string;
  apiKeyRef: string;
  deleteRemoteFilesAfterExtraction: boolean;
};

export type ProviderRuntimeConfig = ProviderConfig & {
  apiKey: string;
};

export type DocumentRecord = {
  id: string;
  title: string;
  ext: string;
  mime: string;
  status: DocumentStatus;
  localUri?: string | null;
  originalText?: string | null;
  extractedText?: string | null;
  summary?: string | null;
  visualSummary?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentChunk = {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  pageLabel?: string | null;
  sectionTitle?: string | null;
};

export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  id: string;
  documentId: string;
  role: Exclude<ChatRole, "system">;
  content: string;
  sourceChunkIds?: string[] | null;
  createdAt: string;
};

export type ImportAsset = {
  uri: string;
  name: string;
  size?: number;
  mimeType?: string;
  file?: File;
};

export type UploadResult = {
  id: string;
  filename: string;
  bytes: number;
  status: string;
};

export type AIMessage = {
  role: ChatRole;
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } | string }
      >;
};

export type AIProviderAdapter = {
  uploadForExtraction: (
    config: ProviderRuntimeConfig,
    asset: ImportAsset,
  ) => Promise<UploadResult>;
  getExtractedContent: (
    config: ProviderRuntimeConfig,
    fileId: string,
  ) => Promise<string>;
  deleteRemoteFile: (
    config: ProviderRuntimeConfig,
    fileId: string,
  ) => Promise<void>;
  summarizeDocument: (
    config: ProviderRuntimeConfig,
    document: DocumentRecord,
    chunks: DocumentChunk[],
  ) => Promise<{ summary: string; visualSummary: string }>;
  streamDocumentChat: (
    config: ProviderRuntimeConfig,
    messages: AIMessage[],
    onDelta: (delta: string) => void,
  ) => Promise<string>;
  testConnection: (config: ProviderRuntimeConfig) => Promise<void>;
};

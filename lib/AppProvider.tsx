import * as SQLite from "expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { buildDocumentChatMessages, kimiAdapter } from "@/lib/ai/kimi";
import { buildRuntimeConfig, normalizeProviderBaseUrl } from "@/lib/ai/provider";
import { chunkText, searchChunks, selectRelevantChunks } from "@/lib/documents/chunking";
import { titleFromFilename, validateImportAsset } from "@/lib/documents/assets";
import { tryReadOriginalText } from "@/lib/documents/original";
import { DATABASE_NAME, migrateDb } from "@/lib/storage/db";
import {
  addChatMessage,
  deleteDocument as deleteDocumentFromDb,
  getAllChunks,
  getChatMessages,
  getChunks,
  getDocument,
  getDocuments,
  getProviderConfig,
  patchDocument,
  replaceChunks,
  saveProviderConfig,
  upsertDocument,
} from "@/lib/storage/repository";
import { getSecret, setSecret } from "@/lib/storage/secure";
import type {
  ChatMessage,
  DocumentChunk,
  DocumentRecord,
  ImportAsset,
  ProviderConfig,
  ProviderRuntimeConfig,
} from "@/lib/types";
import { formatShortDate, nowIso } from "@/lib/utils/dates";
import { getErrorMessage } from "@/lib/utils/errors";
import { makeId } from "@/lib/utils/id";

type SearchResult = {
  id: string;
  type: "document" | "chunk" | "chat";
  documentId: string;
  title: string;
  excerpt: string;
  meta: string;
};

type AppContextValue = {
  ready: boolean;
  db: SQLiteDatabase | null;
  documents: DocumentRecord[];
  config: ProviderConfig;
  apiKey: string;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  refresh: () => Promise<void>;
  saveConfig: (next: ProviderConfig, apiKey: string) => Promise<void>;
  testConnection: (override?: { config: ProviderConfig; apiKey: string }) => Promise<void>;
  importAsset: (asset: ImportAsset) => Promise<DocumentRecord>;
  deleteDocument: (documentId: string) => Promise<void>;
  getDocumentById: (documentId: string) => Promise<DocumentRecord | null>;
  getDocumentChunks: (documentId: string) => Promise<DocumentChunk[]>;
  getMessages: (documentId: string) => Promise<ChatMessage[]>;
  sendQuestion: (
    documentId: string,
    question: string,
    onDelta: (delta: string) => void,
  ) => Promise<ChatMessage>;
  searchAll: (query: string) => Promise<SearchResult[]>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [config, setConfigState] = useState<ProviderConfig>({
    baseUrl: "https://api.moonshot.cn/v1",
    model: "kimi-k2.6",
    apiKeyRef: "document-ai-provider-api-key",
    deleteRemoteFilesAfterExtraction: true,
  });
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    let mounted = true;
    async function boot() {
      const nextDb = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await migrateDb(nextDb);
      const storedConfig = await getProviderConfig(nextDb);
      const storedKey = (await getSecret(storedConfig.apiKeyRef)) ?? "";
      const storedDocuments = await getDocuments(nextDb);
      if (!mounted) {
        return;
      }
      setDb(nextDb);
      setConfigState(storedConfig);
      setApiKey(storedKey);
      setDocuments(storedDocuments);
      setReady(true);
    }
    boot().catch((error) => {
      console.error(error);
      setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const openDrawer = useCallback(() => {
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const refresh = useCallback(async () => {
    if (!db) {
      return;
    }
    setDocuments(await getDocuments(db));
  }, [db]);

  const saveConfig = useCallback(
    async (next: ProviderConfig, nextApiKey: string) => {
      if (!db) {
        return;
      }
      const normalized = { ...next, baseUrl: normalizeProviderBaseUrl(next.baseUrl) };
      await saveProviderConfig(db, normalized);
      await setSecret(normalized.apiKeyRef, nextApiKey.trim());
      setConfigState(normalized);
      setApiKey(nextApiKey.trim());
    },
    [db],
  );

  const runtimeConfig = useCallback(
    (override?: { config: ProviderConfig; apiKey: string }): ProviderRuntimeConfig =>
      buildRuntimeConfig(override?.config ?? config, override?.apiKey ?? apiKey),
    [apiKey, config],
  );

  const testConnection = useCallback(
    async (override?: { config: ProviderConfig; apiKey: string }) => {
      await kimiAdapter.testConnection(runtimeConfig(override));
    },
    [runtimeConfig],
  );

  const importAsset = useCallback(
    async (asset: ImportAsset) => {
      if (!db) {
        throw new Error("Database is not ready yet.");
      }

      const { ext } = validateImportAsset(asset);
      const originalText = await tryReadOriginalText(asset, ext);
      const timestamp = nowIso();
      const document: DocumentRecord = {
        id: makeId("doc"),
        title: titleFromFilename(asset.name),
        ext,
        mime: asset.mimeType ?? "application/octet-stream",
        status: "queued",
        localUri: asset.uri,
        originalText,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await upsertDocument(db, document);
      await refresh();

      try {
        await updateDocument(db, document.id, "uploading");
        const upload = await kimiAdapter.uploadForExtraction(runtimeConfig(), asset);
        await updateDocument(db, document.id, "extracting");
        const extractedText = await kimiAdapter.getExtractedContent(runtimeConfig(), upload.id);

        if (config.deleteRemoteFilesAfterExtraction) {
          await kimiAdapter.deleteRemoteFile(runtimeConfig(), upload.id).catch(() => undefined);
        }

        const chunks = chunkText(document.id, extractedText);
        if (chunks.length === 0) {
          throw new Error("The parser did not return readable text for this document.");
        }

        await replaceChunks(db, document.id, chunks);
        await patchDocument(db, document.id, {
          extractedText,
          status: "summarizing",
          updatedAt: nowIso(),
        });
        await refresh();

        const stored = await getDocument(db, document.id);
        if (!stored) {
          throw new Error("Imported document disappeared before summarization.");
        }

        const summary = await kimiAdapter.summarizeDocument(runtimeConfig(), stored, chunks);
        await patchDocument(db, document.id, {
          summary: summary.summary,
          visualSummary: summary.visualSummary,
          status: "ready",
          error: null,
          updatedAt: nowIso(),
        });
        await refresh();

        const finalDocument = await getDocument(db, document.id);
        return finalDocument ?? document;
      } catch (error) {
        await patchDocument(db, document.id, {
          status: "failed",
          error: getErrorMessage(error),
          updatedAt: nowIso(),
        });
        await refresh();
        throw error;
      }
    },
    [config.deleteRemoteFilesAfterExtraction, db, refresh, runtimeConfig],
  );

  const deleteDocument = useCallback(
    async (documentId: string) => {
      if (!db) {
        return;
      }
      await deleteDocumentFromDb(db, documentId);
      await refresh();
    },
    [db, refresh],
  );

  const getDocumentById = useCallback(
    async (documentId: string) => {
      if (!db) {
        return null;
      }
      return getDocument(db, documentId);
    },
    [db],
  );

  const getDocumentChunks = useCallback(
    async (documentId: string) => {
      if (!db) {
        return [];
      }
      return getChunks(db, documentId);
    },
    [db],
  );

  const getMessages = useCallback(
    async (documentId: string) => {
      if (!db) {
        return [];
      }
      return getChatMessages(db, documentId);
    },
    [db],
  );

  const sendQuestion = useCallback(
    async (documentId: string, question: string, onDelta: (delta: string) => void) => {
      if (!db) {
        throw new Error("Database is not ready yet.");
      }
      const document = await getDocument(db, documentId);
      if (!document) {
        throw new Error("Document not found.");
      }
      const chunks = await getChunks(db, documentId);
      const relevant = selectRelevantChunks(chunks, question, 5);
      const history = await getChatMessages(db, documentId);
      const userMessage: ChatMessage = {
        id: makeId("msg"),
        documentId,
        role: "user",
        content: question,
        createdAt: nowIso(),
      };
      await addChatMessage(db, userMessage);

      const messages = buildDocumentChatMessages(
        document,
        relevant,
        history.map(({ role, content }) => ({ role, content })),
        question,
      );
      const content = await kimiAdapter.streamDocumentChat(runtimeConfig(), messages, onDelta);
      const assistantMessage: ChatMessage = {
        id: makeId("msg"),
        documentId,
        role: "assistant",
        content,
        sourceChunkIds: relevant.map((chunk) => chunk.id),
        createdAt: nowIso(),
      };
      await addChatMessage(db, assistantMessage);
      return assistantMessage;
    },
    [db, runtimeConfig],
  );

  const searchAll = useCallback(
    async (query: string) => {
      if (!db || !query.trim()) {
        return [];
      }
      const docs = await getDocuments(db);
      const chunks = await getAllChunks(db);
      const results: SearchResult[] = [];
      const lower = query.toLowerCase();

      for (const doc of docs) {
        if (doc.title.toLowerCase().includes(lower)) {
          results.push({
            id: `doc-${doc.id}`,
            type: "document",
            documentId: doc.id,
            title: doc.title,
            excerpt: doc.summary?.slice(0, 180) || "Document title match.",
            meta: `${doc.ext.toUpperCase()} · ${formatShortDate(doc.updatedAt)}`,
          });
        }
      }

      for (const item of searchChunks(chunks, query, 20)) {
        const doc = docs.find((candidate) => candidate.id === item.chunk.documentId);
        if (!doc) {
          continue;
        }
        results.push({
          id: `chunk-${item.chunk.id}`,
          type: "chunk",
          documentId: doc.id,
          title: doc.title,
          excerpt: item.excerpt,
          meta: `Chunk ${item.chunk.chunkIndex + 1}`,
        });
      }

      for (const doc of docs) {
        const messages = await getChatMessages(db, doc.id);
        for (const message of messages) {
          if (message.content.toLowerCase().includes(lower)) {
            results.push({
              id: `chat-${message.id}`,
              type: "chat",
              documentId: doc.id,
              title: doc.title,
              excerpt: message.content.slice(0, 220),
              meta: `Chat · ${formatShortDate(message.createdAt)}`,
            });
          }
        }
      }

      return results.slice(0, 40);
    },
    [db],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      db,
      documents,
      config,
      apiKey,
      drawerOpen,
      openDrawer,
      closeDrawer,
      refresh,
      saveConfig,
      testConnection,
      importAsset,
      deleteDocument,
      getDocumentById,
      getDocumentChunks,
      getMessages,
      sendQuestion,
      searchAll,
    }),
    [
      ready,
      db,
      documents,
      config,
      apiKey,
      drawerOpen,
      openDrawer,
      closeDrawer,
      refresh,
      saveConfig,
      testConnection,
      importAsset,
      deleteDocument,
      getDocumentById,
      getDocumentChunks,
      getMessages,
      sendQuestion,
      searchAll,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider.");
  }
  return context;
}

async function updateDocument(
  db: SQLiteDatabase,
  id: string,
  status: DocumentRecord["status"],
) {
  await patchDocument(db, id, {
    status,
    error: null,
    updatedAt: nowIso(),
  });
}

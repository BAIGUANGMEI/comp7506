import * as SQLite from "expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  createFolder as createFolderInDb,
  deleteDocument as deleteDocumentFromDb,
  deleteFolder as deleteFolderFromDb,
  getAllChunks,
  getChatMessages,
  getChunks,
  getDocument,
  getDocuments,
  getDocumentsByFolder,
  getFolder,
  getFolders,
  getProviderConfig,
  getUserProfile,
  moveDocumentToFolder as moveDocumentToFolderInDb,
  patchDocument,
  replaceChunks,
  renameFolder as renameFolderInDb,
  saveProviderConfig,
  saveUserProfile as saveUserProfileToDb,
  upsertDocument,
} from "@/lib/storage/repository";
import { getSecret, setSecret } from "@/lib/storage/secure";
import type {
  ChatMessage,
  ActiveChat,
  DocumentChunk,
  DocumentRecord,
  FolderRecord,
  ImportAsset,
  ProviderConfig,
  ProviderRuntimeConfig,
  UserProfile,
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
  folders: FolderRecord[];
  config: ProviderConfig;
  profile: UserProfile;
  apiKey: string;
  activeChats: Record<string, ActiveChat>;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  refresh: () => Promise<void>;
  saveConfig: (next: ProviderConfig, apiKey: string) => Promise<void>;
  saveProfile: (next: UserProfile) => Promise<void>;
  testConnection: (override?: { config: ProviderConfig; apiKey: string }) => Promise<void>;
  importAsset: (
    asset: ImportAsset,
    options?: { analyzeWithAi?: boolean; folderId?: string | null },
  ) => Promise<DocumentRecord>;
  deleteDocument: (documentId: string) => Promise<void>;
  createFolder: (name: string) => Promise<FolderRecord>;
  renameFolder: (folderId: string, name: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  moveDocumentToFolder: (documentId: string, folderId: string | null) => Promise<void>;
  getDocumentById: (documentId: string) => Promise<DocumentRecord | null>;
  getFolderById: (folderId: string) => Promise<FolderRecord | null>;
  getDocumentsForFolder: (folderId: string) => Promise<DocumentRecord[]>;
  getDocumentChunks: (documentId: string) => Promise<DocumentChunk[]>;
  getMessages: (documentId: string) => Promise<ChatMessage[]>;
  sendQuestion: (
    documentId: string,
    question: string,
    onDelta?: (delta: string) => void,
  ) => Promise<ChatMessage>;
  searchAll: (query: string) => Promise<SearchResult[]>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [folders, setFolders] = useState<FolderRecord[]>([]);
  const [profile, setProfile] = useState<UserProfile>({
    displayName: "User",
    avatarDataUri: null,
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeChats, setActiveChats] = useState<Record<string, ActiveChat>>({});
  const activeChatTasks = useRef<Partial<Record<string, Promise<ChatMessage>>>>({});
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
      const storedProfile = await getUserProfile(nextDb);
      const storedKey = (await getSecret(storedConfig.apiKeyRef)) ?? "";
      const storedDocuments = await getDocuments(nextDb);
      const storedFolders = await getFolders(nextDb);
      if (!mounted) {
        return;
      }
      setDb(nextDb);
      setConfigState(storedConfig);
      setProfile(storedProfile);
      setApiKey(storedKey);
      setDocuments(storedDocuments);
      setFolders(storedFolders);
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
    const [nextDocuments, nextFolders] = await Promise.all([
      getDocuments(db),
      getFolders(db),
    ]);
    setDocuments(nextDocuments);
    setFolders(nextFolders);
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

  const saveProfile = useCallback(
    async (next: UserProfile) => {
      if (!db) {
        return;
      }
      const normalized: UserProfile = {
        displayName: next.displayName.trim() || "User",
        avatarDataUri: next.avatarDataUri ?? null,
      };
      await saveUserProfileToDb(db, normalized);
      setProfile(normalized);
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
    async (asset: ImportAsset, options?: { analyzeWithAi?: boolean; folderId?: string | null }) => {
      if (!db) {
        throw new Error("Database is not ready yet.");
      }

      const analyzeWithAi = options?.analyzeWithAi ?? true;
      const { ext } = validateImportAsset(asset);
      const originalText = await tryReadOriginalText(asset, ext);
      const timestamp = nowIso();
      const document: DocumentRecord = {
        id: makeId("doc"),
        title: titleFromFilename(asset.name),
        ext,
        mime: asset.mimeType ?? "application/octet-stream",
        status: "queued",
        folderId: options?.folderId ?? null,
        localUri: asset.uri,
        originalText,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await upsertDocument(db, document);
      await refresh();

      if (!analyzeWithAi) {
        const localChunks = originalText ? chunkText(document.id, originalText) : [];
        if (localChunks.length > 0) {
          await replaceChunks(db, document.id, localChunks);
        }
        await patchDocument(db, document.id, {
          status: "local",
          summary:
            "Imported locally without AI analysis. Enable AI analysis during import to generate an overview, visual notes, and document Q&A context.",
          visualSummary: "AI visual analysis was not run for this local import.",
          error: null,
          updatedAt: nowIso(),
        });
        await refresh();
        return (await getDocument(db, document.id)) ?? { ...document, status: "local" };
      }

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

  const createFolder = useCallback(
    async (name: string) => {
      if (!db) {
        throw new Error("Database is not ready yet.");
      }
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error("Folder name is required.");
      }
      const existingFolders = await getFolders(db);
      if (existingFolders.some((folder) => folder.name.toLowerCase() === trimmed.toLowerCase())) {
        throw new Error("A folder with this name already exists.");
      }
      const timestamp = nowIso();
      const folder: FolderRecord = {
        id: makeId("folder"),
        name: trimmed,
        documentCount: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await createFolderInDb(db, folder);
      await refresh();
      return folder;
    },
    [db, refresh],
  );

  const renameFolder = useCallback(
    async (folderId: string, name: string) => {
      if (!db) {
        return;
      }
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error("Folder name is required.");
      }
      const existingFolders = await getFolders(db);
      if (
        existingFolders.some(
          (folder) =>
            folder.id !== folderId &&
            folder.name.toLowerCase() === trimmed.toLowerCase(),
        )
      ) {
        throw new Error("A folder with this name already exists.");
      }
      await renameFolderInDb(db, folderId, trimmed, nowIso());
      await refresh();
    },
    [db, refresh],
  );

  const deleteFolder = useCallback(
    async (folderId: string) => {
      if (!db) {
        return;
      }
      await deleteFolderFromDb(db, folderId);
      await refresh();
    },
    [db, refresh],
  );

  const moveDocumentToFolder = useCallback(
    async (documentId: string, folderId: string | null) => {
      if (!db) {
        return;
      }
      if (folderId) {
        const folder = await getFolder(db, folderId);
        if (!folder) {
          throw new Error("Folder not found.");
        }
      }
      await moveDocumentToFolderInDb(db, documentId, folderId, nowIso());
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

  const getFolderById = useCallback(
    async (folderId: string) => {
      if (!db) {
        return null;
      }
      return getFolder(db, folderId);
    },
    [db],
  );

  const getDocumentsForFolder = useCallback(
    async (folderId: string) => {
      if (!db) {
        return [];
      }
      return getDocumentsByFolder(db, folderId);
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
    async (documentId: string, question: string, onDelta?: (delta: string) => void) => {
      if (activeChatTasks.current[documentId]) {
        throw new Error("A response is already in progress for this document.");
      }
      if (!db) {
        throw new Error("Database is not ready yet.");
      }

      const startedAt = nowIso();
      const task = (async () => {
        setActiveChats((current) => ({
          ...current,
          [documentId]: {
            documentId,
            question,
            partial: "",
            status: "pending",
            error: null,
            startedAt,
          },
        }));

        try {
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
          const content = await kimiAdapter.streamDocumentChat(runtimeConfig(), messages, (delta) => {
            setActiveChats((current) => {
              const active = current[documentId];
              if (!active || active.status !== "pending") {
                return current;
              }
              return {
                ...current,
                [documentId]: {
                  ...active,
                  partial: active.partial + delta,
                },
              };
            });
            onDelta?.(delta);
          });
          const assistantMessage: ChatMessage = {
            id: makeId("msg"),
            documentId,
            role: "assistant",
            content,
            sourceChunkIds: relevant.map((chunk) => chunk.id),
            createdAt: nowIso(),
          };
          await addChatMessage(db, assistantMessage);
          setActiveChats((current) => omitActiveChat(current, documentId));
          return assistantMessage;
        } catch (error) {
          setActiveChats((current) => ({
            ...current,
            [documentId]: {
              documentId,
              question,
              partial: current[documentId]?.partial ?? "",
              status: "failed",
              error: getErrorMessage(error),
              startedAt,
            },
          }));
          throw error;
        }
      })();

      activeChatTasks.current[documentId] = task;
      task.finally(() => {
        delete activeChatTasks.current[documentId];
      }).catch(() => undefined);

      return task;
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
      folders,
      config,
      profile,
      apiKey,
      activeChats,
      drawerOpen,
      openDrawer,
      closeDrawer,
      refresh,
      saveConfig,
      saveProfile,
      testConnection,
      importAsset,
      deleteDocument,
      createFolder,
      renameFolder,
      deleteFolder,
      moveDocumentToFolder,
      getDocumentById,
      getFolderById,
      getDocumentsForFolder,
      getDocumentChunks,
      getMessages,
      sendQuestion,
      searchAll,
    }),
    [
      ready,
      db,
      documents,
      folders,
      config,
      profile,
      apiKey,
      activeChats,
      drawerOpen,
      openDrawer,
      closeDrawer,
      refresh,
      saveConfig,
      saveProfile,
      testConnection,
      importAsset,
      deleteDocument,
      createFolder,
      renameFolder,
      deleteFolder,
      moveDocumentToFolder,
      getDocumentById,
      getFolderById,
      getDocumentsForFolder,
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

function omitActiveChat(chats: Record<string, ActiveChat>, documentId: string) {
  const next = { ...chats };
  delete next[documentId];
  return next;
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

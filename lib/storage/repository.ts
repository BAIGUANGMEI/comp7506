import type { SQLiteDatabase } from "expo-sqlite";
import { DEFAULT_AGENT_CONFIG, DEFAULT_AUTH_CONFIG, DEFAULT_PROVIDER_CONFIG, DEFAULT_USER_PROFILE } from "@/config/defaults";
import type {
  AgentConfig,
  AuthAccount,
  AuthConfig,
  ChatMessage,
  ChatSession,
  DocumentChunk,
  DocumentRecord,
  DocumentStatus,
  FolderRecord,
  ProviderConfig,
  UserProfile,
} from "@/lib/types";

type DocumentRow = {
  id: string;
  title: string;
  ext: string;
  mime: string;
  status: DocumentStatus;
  folder_id: string | null;
  local_uri: string | null;
  file_size_bytes: number | null;
  original_text: string | null;
  extracted_text: string | null;
  summary: string | null;
  visual_summary: string | null;
  error: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type FolderRow = {
  id: string;
  name: string;
  document_count: number;
  created_at: string;
  updated_at: string;
};

type ChunkRow = {
  id: string;
  document_id: string;
  chunk_index: number;
  text: string;
  page_label: string | null;
  section_title: string | null;
};

type ChatRow = {
  id: string;
  document_id: string;
  session_id: string | null;
  role: "user" | "assistant";
  content: string;
  source_chunk_ids: string | null;
  created_at: string;
};

type ChatSessionRow = {
  id: string;
  document_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export async function getProviderConfig(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    ["providerConfig"],
  );
  if (!row?.value) {
    return DEFAULT_PROVIDER_CONFIG;
  }
  return { ...DEFAULT_PROVIDER_CONFIG, ...JSON.parse(row.value) } as ProviderConfig;
}

export async function saveProviderConfig(db: SQLiteDatabase, config: ProviderConfig) {
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    "providerConfig",
    JSON.stringify(config),
  );
}

export async function getUserProfile(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    ["userProfile"],
  );
  if (!row?.value) {
    return DEFAULT_USER_PROFILE;
  }
  return { ...DEFAULT_USER_PROFILE, ...JSON.parse(row.value) } as UserProfile;
}

export async function saveUserProfile(db: SQLiteDatabase, profile: UserProfile) {
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    "userProfile",
    JSON.stringify(profile),
  );
}

export async function getAgentConfig(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    ["agentConfig"],
  );
  if (!row?.value) {
    return DEFAULT_AGENT_CONFIG;
  }
  return { ...DEFAULT_AGENT_CONFIG, ...JSON.parse(row.value) } as AgentConfig;
}

export async function saveAgentConfig(db: SQLiteDatabase, config: AgentConfig) {
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    "agentConfig",
    JSON.stringify(config),
  );
}

export async function getAuthConfig(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    ["authConfig"],
  );
  if (!row?.value) {
    return DEFAULT_AUTH_CONFIG;
  }
  return mergeAuthConfigWithEnv(JSON.parse(row.value) as Partial<AuthConfig>);
}

export async function saveAuthConfig(db: SQLiteDatabase, config: AuthConfig) {
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    "authConfig",
    JSON.stringify(config),
  );
}

export async function getAuthAccount(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    ["authAccount"],
  );
  return row?.value ? (JSON.parse(row.value) as AuthAccount) : null;
}

export async function saveAuthAccount(db: SQLiteDatabase, account: AuthAccount) {
  await db.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    "authAccount",
    JSON.stringify(account),
  );
}

export async function clearAuthAccount(db: SQLiteDatabase) {
  await db.runAsync("DELETE FROM settings WHERE key = ?", "authAccount");
}

function mergeAuthConfigWithEnv(stored: Partial<AuthConfig>): AuthConfig {
  const merged = { ...DEFAULT_AUTH_CONFIG, ...stored };
  return {
    googleWebClientId: DEFAULT_AUTH_CONFIG.googleWebClientId || merged.googleWebClientId || "",
    googleIosClientId: DEFAULT_AUTH_CONFIG.googleIosClientId || merged.googleIosClientId || "",
    googleAndroidClientId: DEFAULT_AUTH_CONFIG.googleAndroidClientId || merged.googleAndroidClientId || "",
  };
}

export async function getDocuments(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<DocumentRow>(
    "SELECT * FROM documents WHERE deleted_at IS NULL ORDER BY updated_at DESC",
  );
  return rows.map(mapDocumentRow);
}

export async function getTrashedDocuments(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<DocumentRow>(
    "SELECT * FROM documents WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC, updated_at DESC",
  );
  return rows.map(mapDocumentRow);
}

export async function getDocumentsByFolder(db: SQLiteDatabase, folderId: string) {
  const rows = await db.getAllAsync<DocumentRow>(
    "SELECT * FROM documents WHERE folder_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC",
    [folderId],
  );
  return rows.map(mapDocumentRow);
}

export async function getDocument(db: SQLiteDatabase, id: string) {
  const row = await db.getFirstAsync<DocumentRow>(
    "SELECT * FROM documents WHERE id = ?",
    [id],
  );
  return row ? mapDocumentRow(row) : null;
}

export async function upsertDocument(db: SQLiteDatabase, document: DocumentRecord) {
  await db.runAsync(
    `INSERT OR REPLACE INTO documents (
      id, title, ext, mime, status, folder_id, local_uri, file_size_bytes, original_text, extracted_text,
      summary, visual_summary, error, deleted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    document.id,
    document.title,
    document.ext,
    document.mime,
    document.status,
    document.folderId ?? null,
    document.localUri ?? null,
    document.fileSizeBytes ?? null,
    document.originalText ?? null,
    document.extractedText ?? null,
    document.summary ?? null,
    document.visualSummary ?? null,
    document.error ?? null,
    document.deletedAt ?? null,
    document.createdAt,
    document.updatedAt,
  );
}

export async function patchDocument(
  db: SQLiteDatabase,
  id: string,
  patch: Partial<
    Pick<
      DocumentRecord,
      | "status"
      | "folderId"
      | "localUri"
      | "fileSizeBytes"
      | "originalText"
      | "extractedText"
      | "summary"
      | "visualSummary"
      | "error"
      | "deletedAt"
      | "updatedAt"
    >
  >,
) {
  const current = await getDocument(db, id);
  if (!current) {
    return;
  }
  await upsertDocument(db, { ...current, ...patch });
}

export async function moveDocumentToTrash(db: SQLiteDatabase, id: string, deletedAt: string) {
  await patchDocument(db, id, {
    deletedAt,
    updatedAt: deletedAt,
  });
}

export async function restoreDocument(db: SQLiteDatabase, id: string, updatedAt: string) {
  await patchDocument(db, id, {
    deletedAt: null,
    updatedAt,
  });
}

export async function permanentlyDeleteDocument(db: SQLiteDatabase, id: string) {
  await db.runAsync("DELETE FROM chat_messages WHERE document_id = ?", id);
  await db.runAsync("DELETE FROM chat_sessions WHERE document_id = ?", id);
  await db.runAsync("DELETE FROM document_chunks WHERE document_id = ?", id);
  await db.runAsync("DELETE FROM documents WHERE id = ?", id);
}

export async function getFolders(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<FolderRow>(
    `SELECT
      folders.id,
      folders.name,
      folders.created_at,
      folders.updated_at,
      COUNT(documents.id) AS document_count
     FROM folders
     LEFT JOIN documents ON documents.folder_id = folders.id AND documents.deleted_at IS NULL
     GROUP BY folders.id
     ORDER BY folders.updated_at DESC, folders.name ASC`,
  );
  return rows.map(mapFolderRow);
}

export async function getFolder(db: SQLiteDatabase, id: string) {
  const row = await db.getFirstAsync<FolderRow>(
    `SELECT
      folders.id,
      folders.name,
      folders.created_at,
      folders.updated_at,
      COUNT(documents.id) AS document_count
     FROM folders
     LEFT JOIN documents ON documents.folder_id = folders.id AND documents.deleted_at IS NULL
     WHERE folders.id = ?
     GROUP BY folders.id`,
    [id],
  );
  return row ? mapFolderRow(row) : null;
}

export async function createFolder(db: SQLiteDatabase, folder: Omit<FolderRecord, "documentCount">) {
  await db.runAsync(
    `INSERT INTO folders (id, name, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
    folder.id,
    folder.name,
    folder.createdAt,
    folder.updatedAt,
  );
}

export async function renameFolder(
  db: SQLiteDatabase,
  id: string,
  name: string,
  updatedAt: string,
) {
  await db.runAsync(
    "UPDATE folders SET name = ?, updated_at = ? WHERE id = ?",
    name,
    updatedAt,
    id,
  );
}

export async function deleteFolder(db: SQLiteDatabase, id: string) {
  await db.withTransactionAsync(async () => {
    await db.runAsync("UPDATE documents SET folder_id = NULL WHERE folder_id = ?", id);
    await db.runAsync("DELETE FROM folders WHERE id = ?", id);
  });
}

export async function moveDocumentToFolder(
  db: SQLiteDatabase,
  documentId: string,
  folderId: string | null,
  updatedAt: string,
) {
  await db.runAsync(
    "UPDATE documents SET folder_id = ?, updated_at = ? WHERE id = ?",
    folderId,
    updatedAt,
    documentId,
  );
  if (folderId) {
    await db.runAsync(
      "UPDATE folders SET updated_at = ? WHERE id = ?",
      updatedAt,
      folderId,
    );
  }
}

export async function replaceChunks(
  db: SQLiteDatabase,
  documentId: string,
  chunks: DocumentChunk[],
) {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM document_chunks WHERE document_id = ?", documentId);
    for (const chunk of chunks) {
      await db.runAsync(
        `INSERT INTO document_chunks (
          id, document_id, chunk_index, text, page_label, section_title
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        chunk.id,
        chunk.documentId,
        chunk.chunkIndex,
        chunk.text,
        chunk.pageLabel ?? null,
        chunk.sectionTitle ?? null,
      );
    }
  });
}

export async function getChunks(db: SQLiteDatabase, documentId: string) {
  const rows = await db.getAllAsync<ChunkRow>(
    "SELECT * FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC",
    [documentId],
  );
  return rows.map(mapChunkRow);
}

export async function getAllChunks(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<ChunkRow>(
    "SELECT * FROM document_chunks ORDER BY document_id ASC, chunk_index ASC",
  );
  return rows.map(mapChunkRow);
}

export async function createChatSession(db: SQLiteDatabase, session: ChatSession) {
  await db.runAsync(
    `INSERT INTO chat_sessions (id, document_id, title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    session.id,
    session.documentId,
    session.title,
    session.createdAt,
    session.updatedAt,
  );
}

export async function updateChatSession(
  db: SQLiteDatabase,
  sessionId: string,
  patch: Partial<Pick<ChatSession, "title" | "updatedAt">>,
) {
  const current = await getChatSession(db, sessionId);
  if (!current) {
    return;
  }
  await db.runAsync(
    "UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?",
    patch.title ?? current.title,
    patch.updatedAt ?? current.updatedAt,
    sessionId,
  );
}

export async function deleteChatSession(db: SQLiteDatabase, sessionId: string) {
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM chat_messages WHERE session_id = ?", sessionId);
    await db.runAsync("DELETE FROM chat_sessions WHERE id = ?", sessionId);
  });
}

export async function getChatSession(db: SQLiteDatabase, sessionId: string) {
  const row = await db.getFirstAsync<ChatSessionRow>(
    "SELECT * FROM chat_sessions WHERE id = ?",
    [sessionId],
  );
  return row ? mapChatSessionRow(row) : null;
}

export async function getChatSessions(db: SQLiteDatabase, documentId: string) {
  const rows = await db.getAllAsync<ChatSessionRow>(
    "SELECT * FROM chat_sessions WHERE document_id = ? ORDER BY updated_at DESC, created_at DESC",
    [documentId],
  );
  return rows.map(mapChatSessionRow);
}

export async function getChatMessages(db: SQLiteDatabase, documentId: string) {
  const rows = await db.getAllAsync<ChatRow>(
    "SELECT * FROM chat_messages WHERE document_id = ? ORDER BY created_at ASC",
    [documentId],
  );
  return rows.map(mapChatRow);
}

export async function getChatMessagesForSession(db: SQLiteDatabase, sessionId: string) {
  const rows = await db.getAllAsync<ChatRow>(
    "SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC",
    [sessionId],
  );
  return rows.map(mapChatRow);
}

export async function addChatMessage(db: SQLiteDatabase, message: ChatMessage) {
  await db.runAsync(
    `INSERT INTO chat_messages (
      id, document_id, session_id, role, content, source_chunk_ids, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    message.id,
    message.documentId,
    message.sessionId ?? null,
    message.role,
    message.content,
    message.sourceChunkIds ? JSON.stringify(message.sourceChunkIds) : null,
    message.createdAt,
  );
}

function mapDocumentRow(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    title: row.title,
    ext: row.ext,
    mime: row.mime,
    status: row.status,
    folderId: row.folder_id,
    localUri: row.local_uri,
    fileSizeBytes: row.file_size_bytes,
    originalText: row.original_text,
    extractedText: row.extracted_text,
    summary: row.summary,
    visualSummary: row.visual_summary,
    error: row.error,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFolderRow(row: FolderRow): FolderRecord {
  return {
    id: row.id,
    name: row.name,
    documentCount: row.document_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChunkRow(row: ChunkRow): DocumentChunk {
  return {
    id: row.id,
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
    text: row.text,
    pageLabel: row.page_label,
    sectionTitle: row.section_title,
  };
}

function mapChatSessionRow(row: ChatSessionRow): ChatSession {
  return {
    id: row.id,
    documentId: row.document_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChatRow(row: ChatRow): ChatMessage {
  return {
    id: row.id,
    documentId: row.document_id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    sourceChunkIds: row.source_chunk_ids ? JSON.parse(row.source_chunk_ids) : null,
    createdAt: row.created_at,
  };
}

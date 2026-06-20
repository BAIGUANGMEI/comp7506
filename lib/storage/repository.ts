import type { SQLiteDatabase } from "expo-sqlite";
import { DEFAULT_PROVIDER_CONFIG } from "@/config/defaults";
import type {
  ChatMessage,
  DocumentChunk,
  DocumentRecord,
  DocumentStatus,
  ProviderConfig,
} from "@/lib/types";

type DocumentRow = {
  id: string;
  title: string;
  ext: string;
  mime: string;
  status: DocumentStatus;
  local_uri: string | null;
  original_text: string | null;
  extracted_text: string | null;
  summary: string | null;
  visual_summary: string | null;
  error: string | null;
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
  role: "user" | "assistant";
  content: string;
  source_chunk_ids: string | null;
  created_at: string;
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

export async function getDocuments(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<DocumentRow>(
    "SELECT * FROM documents ORDER BY updated_at DESC",
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
      id, title, ext, mime, status, local_uri, original_text, extracted_text,
      summary, visual_summary, error, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    document.id,
    document.title,
    document.ext,
    document.mime,
    document.status,
    document.localUri ?? null,
    document.originalText ?? null,
    document.extractedText ?? null,
    document.summary ?? null,
    document.visualSummary ?? null,
    document.error ?? null,
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
      | "localUri"
      | "originalText"
      | "extractedText"
      | "summary"
      | "visualSummary"
      | "error"
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

export async function deleteDocument(db: SQLiteDatabase, id: string) {
  await db.runAsync("DELETE FROM chat_messages WHERE document_id = ?", id);
  await db.runAsync("DELETE FROM document_chunks WHERE document_id = ?", id);
  await db.runAsync("DELETE FROM documents WHERE id = ?", id);
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

export async function getChatMessages(db: SQLiteDatabase, documentId: string) {
  const rows = await db.getAllAsync<ChatRow>(
    "SELECT * FROM chat_messages WHERE document_id = ? ORDER BY created_at ASC",
    [documentId],
  );
  return rows.map(mapChatRow);
}

export async function addChatMessage(db: SQLiteDatabase, message: ChatMessage) {
  await db.runAsync(
    `INSERT INTO chat_messages (
      id, document_id, role, content, source_chunk_ids, created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    message.id,
    message.documentId,
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
    localUri: row.local_uri,
    originalText: row.original_text,
    extractedText: row.extracted_text,
    summary: row.summary,
    visualSummary: row.visual_summary,
    error: row.error,
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

function mapChatRow(row: ChatRow): ChatMessage {
  return {
    id: row.id,
    documentId: row.document_id,
    role: row.role,
    content: row.content,
    sourceChunkIds: row.source_chunk_ids ? JSON.parse(row.source_chunk_ids) : null,
    createdAt: row.created_at,
  };
}

import type { SQLiteDatabase } from "expo-sqlite";

export const DATABASE_NAME = "document-ai.db";

export async function migrateDb(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      ext TEXT NOT NULL,
      mime TEXT NOT NULL,
      status TEXT NOT NULL,
      folder_id TEXT,
      local_uri TEXT,
      file_size_bytes INTEGER,
      original_text TEXT,
      extracted_text TEXT,
      summary TEXT,
      visual_summary TEXT,
      error TEXT,
      deleted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_chunks (
      id TEXT PRIMARY KEY NOT NULL,
      document_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      page_label TEXT,
      section_title TEXT,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      document_id TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      document_id TEXT NOT NULL,
      session_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      source_chunk_ids TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_document_id
      ON document_chunks(document_id);

    CREATE INDEX IF NOT EXISTS idx_chat_document_id_created_at
      ON chat_messages(document_id, created_at);
  `);

  const columns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(documents)");
  if (!columns.some((column) => column.name === "original_text")) {
    await db.execAsync("ALTER TABLE documents ADD COLUMN original_text TEXT");
  }
  if (!columns.some((column) => column.name === "folder_id")) {
    await db.execAsync("ALTER TABLE documents ADD COLUMN folder_id TEXT");
  }
  if (!columns.some((column) => column.name === "deleted_at")) {
    await db.execAsync("ALTER TABLE documents ADD COLUMN deleted_at TEXT");
  }
  if (!columns.some((column) => column.name === "file_size_bytes")) {
    await db.execAsync("ALTER TABLE documents ADD COLUMN file_size_bytes INTEGER");
  }

  const chatColumns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(chat_messages)");
  if (!chatColumns.some((column) => column.name === "session_id")) {
    await db.execAsync("ALTER TABLE chat_messages ADD COLUMN session_id TEXT");
  }

  await db.execAsync(`
    INSERT OR IGNORE INTO chat_sessions (id, document_id, title, created_at, updated_at)
      SELECT
        'session_' || document_id,
        document_id,
        'Conversation',
        MIN(created_at),
        MAX(created_at)
      FROM chat_messages
      WHERE session_id IS NULL
      GROUP BY document_id;

    UPDATE chat_messages
      SET session_id = 'session_' || document_id
      WHERE session_id IS NULL;
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_documents_folder_id
      ON documents(folder_id);

    CREATE INDEX IF NOT EXISTS idx_documents_deleted_at
      ON documents(deleted_at);

    CREATE INDEX IF NOT EXISTS idx_chat_sessions_document_id_updated_at
      ON chat_sessions(document_id, updated_at);

    CREATE INDEX IF NOT EXISTS idx_chat_session_id_created_at
      ON chat_messages(session_id, created_at);
  `);

  const seeded = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    ["defaultFoldersSeeded"],
  );
  if (!seeded) {
    const now = new Date().toISOString();
    for (const folder of DEFAULT_FOLDERS) {
      await db.runAsync(
        `INSERT OR IGNORE INTO folders (id, name, created_at, updated_at)
         VALUES (?, ?, ?, ?)`,
        folder.id,
        folder.name,
        now,
        now,
      );
    }
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      "defaultFoldersSeeded",
      "true",
    );
  }
}

const DEFAULT_FOLDERS = [
  { id: "folder_product_docs", name: "Product Docs" },
  { id: "folder_research_notes", name: "Research Notes" },
  { id: "folder_archive", name: "Archive" },
];

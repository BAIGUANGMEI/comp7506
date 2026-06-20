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
      original_text TEXT,
      extracted_text TEXT,
      summary TEXT,
      visual_summary TEXT,
      error TEXT,
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

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      document_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      source_chunk_ids TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
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

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_documents_folder_id
      ON documents(folder_id);
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

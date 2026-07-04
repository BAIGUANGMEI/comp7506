import { describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { migrateDb } from "@/lib/storage/db";

describe("database migrations", () => {
  it("adds new document columns before creating dependent indexes", async () => {
    const db = new FakeLegacyDb();

    await expect(migrateDb(db as unknown as SQLiteDatabase)).resolves.toBeUndefined();

    const folderAlterIndex = db.executed.findIndex((sql) =>
      sql.includes("ALTER TABLE documents ADD COLUMN folder_id TEXT"),
    );
    const folderIndexIndex = db.executed.findIndex((sql) =>
      sql.includes("idx_documents_folder_id"),
    );
    const deletedAtAlterIndex = db.executed.findIndex((sql) =>
      sql.includes("ALTER TABLE documents ADD COLUMN deleted_at TEXT"),
    );
    const deletedAtIndexIndex = db.executed.findIndex((sql) =>
      sql.includes("idx_documents_deleted_at"),
    );
    const sessionAlterIndex = db.executed.findIndex((sql) =>
      sql.includes("ALTER TABLE chat_messages ADD COLUMN session_id TEXT"),
    );
    const sessionIndexIndex = db.executed.findIndex((sql) =>
      sql.includes("idx_chat_session_id_created_at"),
    );
    const fileSizeAlterIndex = db.executed.findIndex((sql) =>
      sql.includes("ALTER TABLE documents ADD COLUMN file_size_bytes INTEGER"),
    );

    expect(folderAlterIndex).toBeGreaterThan(-1);
    expect(folderIndexIndex).toBeGreaterThan(folderAlterIndex);
    expect(deletedAtAlterIndex).toBeGreaterThan(-1);
    expect(deletedAtIndexIndex).toBeGreaterThan(deletedAtAlterIndex);
    expect(sessionAlterIndex).toBeGreaterThan(-1);
    expect(sessionIndexIndex).toBeGreaterThan(sessionAlterIndex);
    expect(fileSizeAlterIndex).toBeGreaterThan(-1);
  });
});

class FakeLegacyDb {
  executed: string[] = [];
  private columns = new Set([
    "id",
    "title",
    "ext",
    "mime",
    "status",
    "local_uri",
    "extracted_text",
    "summary",
    "visual_summary",
    "error",
    "created_at",
    "updated_at",
  ]);

  async execAsync(sql: string) {
    this.executed.push(sql);
    if (sql.includes("idx_documents_folder_id") && !this.columns.has("folder_id")) {
      throw new Error("no such column: folder_id");
    }
    if (sql.includes("idx_documents_deleted_at") && !this.columns.has("deleted_at")) {
      throw new Error("no such column: deleted_at");
    }
    if (sql.includes("ALTER TABLE documents ADD COLUMN original_text TEXT")) {
      this.columns.add("original_text");
    }
    if (sql.includes("ALTER TABLE documents ADD COLUMN folder_id TEXT")) {
      this.columns.add("folder_id");
    }
    if (sql.includes("ALTER TABLE documents ADD COLUMN deleted_at TEXT")) {
      this.columns.add("deleted_at");
    }
    if (sql.includes("ALTER TABLE documents ADD COLUMN file_size_bytes INTEGER")) {
      this.columns.add("file_size_bytes");
    }
  }

  async getAllAsync() {
    return Array.from(this.columns).map((name) => ({ name }));
  }

  async getFirstAsync() {
    return null;
  }

  async runAsync() {
    return { changes: 1, lastInsertRowId: 0 };
  }
}

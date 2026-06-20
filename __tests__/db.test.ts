import { describe, expect, it } from "vitest";
import type { SQLiteDatabase } from "expo-sqlite";
import { migrateDb } from "@/lib/storage/db";

describe("database migrations", () => {
  it("adds folder_id before creating the folder index for existing databases", async () => {
    const db = new FakeLegacyDb();

    await expect(migrateDb(db as unknown as SQLiteDatabase)).resolves.toBeUndefined();

    const folderAlterIndex = db.executed.findIndex((sql) =>
      sql.includes("ALTER TABLE documents ADD COLUMN folder_id TEXT"),
    );
    const folderIndexIndex = db.executed.findIndex((sql) =>
      sql.includes("idx_documents_folder_id"),
    );

    expect(folderAlterIndex).toBeGreaterThan(-1);
    expect(folderIndexIndex).toBeGreaterThan(folderAlterIndex);
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
    if (sql.includes("ALTER TABLE documents ADD COLUMN original_text TEXT")) {
      this.columns.add("original_text");
    }
    if (sql.includes("ALTER TABLE documents ADD COLUMN folder_id TEXT")) {
      this.columns.add("folder_id");
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

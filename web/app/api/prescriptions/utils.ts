import type Database from "better-sqlite3";

export const ensureCurrentPrescriptionColumn = (db: Database.Database) => {
  const columns = db
    .prepare("PRAGMA table_info(prescriptions)")
    .all() as { name?: string }[];
  const hasColumn = columns.some((column) => column.name === "is_current");

  if (!hasColumn) {
    db.prepare(
      "ALTER TABLE prescriptions ADD COLUMN is_current INTEGER DEFAULT 0"
    ).run();
  }
};

import type Database from "better-sqlite3";
import { getDb } from "@/lib/db";

export const ensureNotesTable = () => {
  const db = getDb();
  db.prepare(
    "CREATE TABLE IF NOT EXISTS client_notes (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
      "client_id INTEGER NOT NULL, " +
      "date_seen TEXT NOT NULL, " +
      "notes TEXT NOT NULL, " +
      "done_at TEXT, " +
      "created_at TEXT NOT NULL" +
      ")"
  ).run();
};

export const ensureProductsTable = () => {
  const db = getDb();
  db.prepare(
    "CREATE TABLE IF NOT EXISTS client_products (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
      "client_id INTEGER NOT NULL, " +
      "date TEXT NOT NULL, " +
      "product TEXT NOT NULL, " +
      "size TEXT, " +
      "cost TEXT, " +
      "brand TEXT" +
      ")"
  ).run();
};

export const ensureUploadTokensTable = () => {
  const db = getDb();
  db.prepare(
    "CREATE TABLE IF NOT EXISTS upload_tokens (" +
      "token TEXT PRIMARY KEY, " +
      "mode TEXT NOT NULL, " +
      "client_id INTEGER NOT NULL, " +
      "appointment_id INTEGER, " +
      "expires_at INTEGER NOT NULL, " +
      "used_at INTEGER, " +
      "created_at INTEGER NOT NULL" +
      ")"
  ).run();
};

export const ensureShareTokensTable = () => {
  const db = getDb();
  db.prepare(
    "CREATE TABLE IF NOT EXISTS share_tokens (" +
      "token TEXT PRIMARY KEY, " +
      "prescription_id INTEGER NOT NULL, " +
      "expires_at INTEGER NOT NULL, " +
      "used_at INTEGER, " +
      "created_at INTEGER NOT NULL" +
      ")"
  ).run();
};

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

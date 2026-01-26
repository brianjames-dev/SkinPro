import Database from "better-sqlite3";
import { getDbPath } from "./skinproPaths";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = getDbPath();
    db = new Database(dbPath, { fileMustExist: true });
    db.pragma("journal_mode = WAL");
  }
  return db;
}

import crypto from "crypto";
import { getDb } from "@/lib/db";
import { ensureUploadTokensTable } from "@/lib/api/ensureTables";

export type UploadTokenMode = "photo" | "profile";

export type UploadTokenInfo = {
  token: string;
  mode: UploadTokenMode;
  clientId: number;
  appointmentId: number | null;
  expiresAt: number;
};

type UploadTokenRow = {
  token: string;
  mode: string;
  client_id: number;
  appointment_id: number | null;
  expires_at: number;
  used_at: number | null;
};

const TTL_MINUTES = (() => {
  const raw = process.env.SKINPRO_QR_TOKEN_TTL_MINUTES;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 10;
})();

const generateToken = () => crypto.randomBytes(32).toString("base64url");

const rowToInfo = (row: UploadTokenRow): UploadTokenInfo => ({
  token: row.token,
  mode: row.mode as UploadTokenMode,
  clientId: row.client_id,
  appointmentId: row.appointment_id,
  expiresAt: row.expires_at
});

export const issueUploadToken = (
  mode: UploadTokenMode,
  clientId: number,
  appointmentId?: number | null
) => {
  ensureUploadTokensTable();
  const db = getDb();
  const token = generateToken();
  const now = Date.now();
  const expiresAt = now + Math.max(1, TTL_MINUTES) * 60_000;

  db.prepare(
    "INSERT INTO upload_tokens (token, mode, client_id, appointment_id, expires_at, used_at, created_at) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(token, mode, clientId, appointmentId ?? null, expiresAt, null, now);

  return { token, expiresAt, ttlMinutes: TTL_MINUTES };
};

/** Non-consuming peek for GET form display. */
export const getUploadToken = (token: string): UploadTokenInfo | null => {
  ensureUploadTokensTable();
  const db = getDb();
  const row = db
    .prepare(
      "SELECT token, mode, client_id, appointment_id, expires_at, used_at " +
        "FROM upload_tokens WHERE token = ?"
    )
    .get(token) as UploadTokenRow | undefined;

  if (!row) {
    return null;
  }
  if (row.used_at) {
    return null;
  }
  if (row.expires_at <= Date.now()) {
    return null;
  }

  return rowToInfo(row);
};

/**
 * Atomically mark token used and return its payload if this caller won.
 * Use on successful upload completion to enforce single-use under concurrency.
 */
export const consumeUploadToken = (token: string): UploadTokenInfo | null => {
  ensureUploadTokensTable();
  const db = getDb();
  const now = Date.now();

  const consume = db.transaction(() => {
    const row = db
      .prepare(
        "SELECT token, mode, client_id, appointment_id, expires_at, used_at " +
          "FROM upload_tokens WHERE token = ?"
      )
      .get(token) as UploadTokenRow | undefined;

    if (!row || row.used_at || row.expires_at <= now) {
      return null;
    }

    const result = db
      .prepare(
        "UPDATE upload_tokens SET used_at = ? " +
          "WHERE token = ? AND used_at IS NULL AND expires_at > ?"
      )
      .run(now, token, now);

    if (result.changes !== 1) {
      return null;
    }

    return rowToInfo(row);
  });

  return consume();
};

/** @deprecated Prefer consumeUploadToken for single-use enforcement. */
export const markUploadTokenUsed = (token: string) => {
  ensureUploadTokensTable();
  const db = getDb();
  db.prepare(
    "UPDATE upload_tokens SET used_at = ? " +
      "WHERE token = ? AND used_at IS NULL"
  ).run(Date.now(), token);
};

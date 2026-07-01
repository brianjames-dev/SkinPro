import crypto from "crypto";
import { getDb } from "@/lib/db";
import { ensureShareTokensTable } from "@/lib/api/ensureTables";

export type ShareTokenInfo = {
  token: string;
  prescriptionId: number;
  expiresAt: number;
};

type ShareTokenRow = {
  token: string;
  prescription_id: number;
  expires_at: number;
  used_at: number | null;
};

const TTL_MINUTES = (() => {
  const raw = process.env.SKINPRO_SHARE_TOKEN_TTL_MINUTES;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 10;
})();

const generateToken = () => crypto.randomBytes(32).toString("base64url");

const rowToInfo = (row: ShareTokenRow): ShareTokenInfo => ({
  token: row.token,
  prescriptionId: row.prescription_id,
  expiresAt: row.expires_at
});

export const issueShareToken = (prescriptionId: number) => {
  ensureShareTokensTable();
  const db = getDb();
  const token = generateToken();
  const now = Date.now();
  const expiresAt = now + Math.max(1, TTL_MINUTES) * 60_000;

  db.prepare(
    "INSERT INTO share_tokens (token, prescription_id, expires_at, used_at, created_at) " +
      "VALUES (?, ?, ?, ?, ?)"
  ).run(token, prescriptionId, expiresAt, null, now);

  return { token, expiresAt, ttlMinutes: TTL_MINUTES };
};

/** Non-consuming peek (prefer consumeShareToken for delivery endpoints). */
export const getShareToken = (token: string): ShareTokenInfo | null => {
  ensureShareTokensTable();
  const db = getDb();
  const row = db
    .prepare(
      "SELECT token, prescription_id, expires_at, used_at " +
        "FROM share_tokens WHERE token = ?"
    )
    .get(token) as ShareTokenRow | undefined;

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
 * Enforces single-use under concurrent share-image / share requests.
 */
export const consumeShareToken = (token: string): ShareTokenInfo | null => {
  ensureShareTokensTable();
  const db = getDb();
  const now = Date.now();

  const consume = db.transaction(() => {
    const row = db
      .prepare(
        "SELECT token, prescription_id, expires_at, used_at " +
          "FROM share_tokens WHERE token = ?"
      )
      .get(token) as ShareTokenRow | undefined;

    if (!row || row.used_at || row.expires_at <= now) {
      return null;
    }

    const result = db
      .prepare(
        "UPDATE share_tokens SET used_at = ? " +
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

/** @deprecated Prefer consumeShareToken for single-use enforcement. */
export const markShareTokenUsed = (token: string) => {
  ensureShareTokensTable();
  const db = getDb();
  db.prepare(
    "UPDATE share_tokens SET used_at = ? WHERE token = ? AND used_at IS NULL"
  ).run(Date.now(), token);
};

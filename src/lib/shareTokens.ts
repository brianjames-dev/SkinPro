import crypto from "crypto";
import { getDb } from "@/lib/db";
import { ensureShareTokensTable } from "@/lib/api/ensureTables";

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

export const getShareToken = (token: string) => {
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

  return {
    token: row.token,
    prescriptionId: row.prescription_id,
    expiresAt: row.expires_at
  };
};

export const markShareTokenUsed = (token: string) => {
  ensureShareTokensTable();
  const db = getDb();
  db.prepare("UPDATE share_tokens SET used_at = ? WHERE token = ?").run(
    Date.now(),
    token
  );
};

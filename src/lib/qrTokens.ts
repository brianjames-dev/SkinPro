import crypto from "crypto";
import { getDb } from "@/lib/db";
import { ensureUploadTokensTable } from "@/lib/api/ensureTables";

export type UploadTokenMode = "photo" | "profile";

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

export const getUploadToken = (token: string) => {
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

  return {
    token: row.token,
    mode: row.mode as UploadTokenMode,
    clientId: row.client_id,
    appointmentId: row.appointment_id,
    expiresAt: row.expires_at
  };
};

export const markUploadTokenUsed = (token: string) => {
  ensureUploadTokensTable();
  const db = getDb();
  db.prepare("UPDATE upload_tokens SET used_at = ? WHERE token = ?").run(
    Date.now(),
    token
  );
};

const AUTH_COOKIE_NAME = "skinpro_auth";
const AUTH_TTL_MINUTES = (() => {
  const raw = process.env.SKINPRO_AUTH_TTL_MINUTES;
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 10080;
})();

const encoder = new TextEncoder();

const toBase64Url = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  if (typeof btoa === "function") {
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

const getAuthSecret = () => {
  const secret = process.env.SKINPRO_AUTH_SECRET?.trim();
  if (secret) {
    return secret;
  }
  return process.env.SKINPRO_PIN?.trim() ?? "";
};

export const getAuthPin = () => process.env.SKINPRO_PIN?.trim() ?? "";

export const isAuthEnabled = () => {
  if (process.env.SKINPRO_AUTH_DISABLED === "1") {
    return false;
  }
  return Boolean(getAuthPin());
};

export const getAuthCookieName = () => AUTH_COOKIE_NAME;

const signPayload = async (payload: string) => {
  const secret = getAuthSecret();
  if (!secret) {
    throw new Error("Auth secret not configured.");
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto unavailable.");
  }
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  return toBase64Url(signature);
};

export const issueAuthCookie = async () => {
  const ttlMs = Math.max(1, AUTH_TTL_MINUTES) * 60_000;
  const expiresAt = Date.now() + ttlMs;
  const payload = String(expiresAt);
  const signature = await signPayload(payload);
  return {
    value: `${payload}.${signature}`,
    expiresAt,
    maxAgeSeconds: Math.round(ttlMs / 1000)
  };
};

export const verifyAuthCookie = async (cookieValue: string) => {
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) {
    return false;
  }
  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return false;
  }
  const expected = await signPayload(payload);
  return timingSafeEqual(signature, expected);
};

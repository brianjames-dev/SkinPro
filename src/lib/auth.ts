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

/**
 * Compare PINs in constant time for equal lengths.
 * Different lengths return false after a fixed dummy compare to reduce timing leaks.
 */
export const verifyPin = (provided: string, expected: string) => {
  if (!expected) {
    return false;
  }
  const a = encoder.encode(provided);
  const b = encoder.encode(expected);
  if (a.length !== b.length) {
    // Touch both buffers so length mismatch isn't a pure fast-path.
    let dummy = 0;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i += 1) {
      dummy |= (a[i] ?? 0) ^ (b[i % b.length] ?? 0);
    }
    void dummy;
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
};

const getAuthSecret = () => {
  const secret = process.env.SKINPRO_AUTH_SECRET?.trim();
  if (secret) {
    return secret;
  }
  const pin = process.env.SKINPRO_PIN?.trim() ?? "";
  if (pin && process.env.NODE_ENV !== "test") {
    console.warn(
      "[auth] SKINPRO_AUTH_SECRET is not set; falling back to PIN as HMAC secret. " +
        "Set a long random SKINPRO_AUTH_SECRET in production."
    );
  }
  return pin;
};

export const getAuthPin = () => process.env.SKINPRO_PIN?.trim() ?? "";

/**
 * Auth gate:
 * - Explicit disable only via SKINPRO_AUTH_DISABLED=1 (ignored in production; fail closed).
 * - Missing PIN: open in non-production (with warning); fail closed in production.
 */
export const isAuthEnabled = () => {
  const disabled = process.env.SKINPRO_AUTH_DISABLED === "1";
  const isProd = process.env.NODE_ENV === "production";

  if (disabled) {
    if (isProd) {
      console.error(
        "[auth] SKINPRO_AUTH_DISABLED=1 is ignored in production (fail closed)."
      );
    } else {
      console.warn("[auth] Auth disabled via SKINPRO_AUTH_DISABLED=1 (dev only).");
      return false;
    }
  }

  const pin = getAuthPin();
  if (!pin) {
    if (isProd) {
      console.error(
        "[auth] SKINPRO_PIN is not set — failing closed (all routes require auth)."
      );
      return true;
    }
    console.warn(
      "[auth] SKINPRO_PIN is not set — auth disabled. Set SKINPRO_PIN before LAN use."
    );
    return false;
  }

  return true;
};

export const getAuthCookieName = () => AUTH_COOKIE_NAME;

/** Prefer Secure cookies on HTTPS; set SKINPRO_COOKIE_SECURE=1 to force. */
export const shouldUseSecureCookies = (request?: Request) => {
  if (["1", "true", "yes"].includes((process.env.SKINPRO_COOKIE_SECURE ?? "").toLowerCase())) {
    return true;
  }
  if (["0", "false", "no"].includes((process.env.SKINPRO_COOKIE_SECURE ?? "").toLowerCase())) {
    return false;
  }
  if (request) {
    try {
      return new URL(request.url).protocol === "https:";
    } catch {
      return false;
    }
  }
  return false;
};

/**
 * Only allow same-origin relative paths after login (blocks open redirects).
 */
export const sanitizeNextPath = (raw: string | null | undefined): string => {
  if (!raw) {
    return "/";
  }
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }
  // Block protocol-relative and scheme-looking values after decode.
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) {
      return "/";
    }
  } catch {
    return "/";
  }
  return value;
};

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
  try {
    const expected = await signPayload(payload);
    return timingSafeEqual(signature, expected);
  } catch {
    return false;
  }
};

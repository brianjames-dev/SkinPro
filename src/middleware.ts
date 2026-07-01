import { NextResponse, type NextRequest } from "next/server";
import {
  getAuthCookieName,
  isAuthEnabled,
  verifyAuthCookie
} from "@/lib/auth";
import { checkRateLimit, checkRateLimits } from "@/lib/rateLimit";

const AUTH_PATH = "/auth";
const AUTH_API_PREFIX = "/api/auth";

/**
 * Exact public paths only (token-bearing phone flows).
 * Do NOT prefix-match /api/uploads/qr (would include qr-code) or
 * /api/prescriptions/share (would include share-qr).
 */
const PUBLIC_PATHS = new Set([
  "/api/uploads/qr",
  "/api/uploads/profile",
  "/prescriptions/share",
  "/api/prescriptions/share-image",
  "/api/prescriptions/share"
]);

const QR_UPLOAD_LIMITS = [
  { label: "minute", limit: 10, windowMs: 60_000 },
  { label: "hour", limit: 120, windowMs: 60 * 60_000 }
];
const PROFILE_UPLOAD_LIMITS = [
  { label: "minute", limit: 5, windowMs: 60_000 },
  { label: "hour", limit: 60, windowMs: 60 * 60_000 }
];
const LOGIN_LIMITS = [
  { label: "minute", limit: 5, windowMs: 60_000 },
  { label: "hour", limit: 20, windowMs: 60 * 60_000 }
];
const READ_LIMIT = { limit: 300, windowMs: 60_000 };
const WRITE_LIMIT = { limit: 60, windowMs: 60_000 };

/**
 * Prefer the direct connection IP. Only trust X-Forwarded-For when
 * SKINPRO_TRUST_PROXY=1 (behind a reverse proxy that overwrites the header).
 */
const getRequestIp = (request: NextRequest) => {
  const trustProxy = ["1", "true", "yes"].includes(
    (process.env.SKINPRO_TRUST_PROXY ?? "").toLowerCase()
  );
  if (trustProxy) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0]?.trim() || "unknown";
    }
  }
  return request.ip ?? "unknown";
};

const buildRateLimitResponse = (result: { retryAfter: number }) =>
  new NextResponse(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(result.retryAfter)
    }
  });

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api")) {
    const ip = getRequestIp(request);
    const method = request.method.toUpperCase();

    if (pathname === "/api/auth/login" && method === "POST") {
      const result = checkRateLimits(`login:${ip}`, LOGIN_LIMITS);
      if (!result.ok) {
        return buildRateLimitResponse(result);
      }
    } else if (pathname === "/api/uploads/qr" && method === "POST") {
      const result = checkRateLimits(`qr-upload:${ip}`, QR_UPLOAD_LIMITS);
      if (!result.ok) {
        return buildRateLimitResponse(result);
      }
    } else if (pathname === "/api/uploads/profile" && method === "POST") {
      const result = checkRateLimits(`profile-upload:${ip}`, PROFILE_UPLOAD_LIMITS);
      if (!result.ok) {
        return buildRateLimitResponse(result);
      }
    } else if (method === "GET" || method === "HEAD") {
      const result = checkRateLimit(
        `api-read:${ip}:${pathname}`,
        READ_LIMIT.limit,
        READ_LIMIT.windowMs
      );
      if (!result.ok) {
        return buildRateLimitResponse(result);
      }
    } else {
      const result = checkRateLimit(
        `api-write:${ip}:${pathname}`,
        WRITE_LIMIT.limit,
        WRITE_LIMIT.windowMs
      );
      if (!result.ok) {
        return buildRateLimitResponse(result);
      }
    }
  }

  if (!isAuthEnabled()) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith(AUTH_PATH) ||
    pathname.startsWith(AUTH_API_PREFIX) ||
    PUBLIC_PATHS.has(pathname)
  ) {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(getAuthCookieName())?.value;
  if (cookieValue && (await verifyAuthCookie(cookieValue))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  const nextUrl = request.nextUrl.clone();
  nextUrl.pathname = AUTH_PATH;
  nextUrl.searchParams.set(
    "next",
    `${pathname}${request.nextUrl.search}`
  );
  return NextResponse.redirect(nextUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};

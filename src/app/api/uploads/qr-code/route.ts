import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getLocalIp } from "@/lib/network";
import { issueUploadToken } from "@/lib/qrTokens";

export const runtime = "nodejs";

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return true;
  }
  // IPv4 private ranges
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }
  const m = host.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) {
      return true;
    }
  }
  return false;
}

function parseHostCandidate(raw: string): { origin: string; hostname: string } | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  try {
    const withScheme = value.startsWith("http://") || value.startsWith("https://")
      ? value
      : `http://${value}`;
    const url = new URL(withScheme);
    if (url.username || url.password) {
      return null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return { origin: url.origin, hostname: url.hostname };
  } catch {
    return null;
  }
}

function isAllowedQrBase(origin: string, hostname: string): boolean {
  const allowlist = (process.env.SKINPRO_QR_HOST_ALLOWLIST ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (allowlist.length > 0) {
    return allowlist.some((entry) => {
      const parsed = parseHostCandidate(entry);
      if (!parsed) {
        return entry === origin || entry === hostname;
      }
      return parsed.origin === origin || parsed.hostname === hostname;
    });
  }

  // Default: only loopback / private LAN hosts (no public phishing targets).
  return isPrivateOrLoopbackHost(hostname);
}

function resolveBaseUrl(request: Request): string {
  const envHost = process.env.SKINPRO_QR_HOST?.trim();
  if (envHost) {
    const parsed = parseHostCandidate(envHost);
    if (parsed && isAllowedQrBase(parsed.origin, parsed.hostname)) {
      return parsed.origin;
    }
    console.warn(
      "[qr-code] SKINPRO_QR_HOST rejected by allowlist/private-host check:",
      envHost
    );
  }

  const hostHeader = request.headers.get("host") ?? "";
  const [, port] = hostHeader.split(":");
  const resolvedPort = port || "3000";
  const lanEnabled = ["1", "true", "yes"].includes(
    (process.env.SKINPRO_QR_LAN ?? "").toLowerCase()
  );

  if (!lanEnabled) {
    return `http://127.0.0.1:${resolvedPort}`;
  }

  const localIp = getLocalIp() ?? "127.0.0.1";
  return `http://${localIp}:${resolvedPort}`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const mode = url.searchParams.get("mode") ?? "photo";
    const clientId = Number(url.searchParams.get("client_id"));
    const appointmentId = Number(url.searchParams.get("appointment_id"));
    // Request-level host override removed — use SKINPRO_QR_HOST / allowlist only.

    if (!Number.isFinite(clientId)) {
      return NextResponse.json(
        { error: "client_id is required" },
        { status: 400 }
      );
    }

    if (mode !== "profile" && !Number.isFinite(appointmentId)) {
      return NextResponse.json(
        { error: "appointment_id is required for photo uploads" },
        { status: 400 }
      );
    }

    const issued = issueUploadToken(
      mode === "profile" ? "profile" : "photo",
      clientId,
      mode === "profile" ? null : appointmentId
    );
    const baseUrl = resolveBaseUrl(request);
    const uploadUrl =
      mode === "profile"
        ? `${baseUrl}/api/uploads/profile?token=${issued.token}`
        : `${baseUrl}/api/uploads/qr?token=${issued.token}`;

    const qrDataUrl = await QRCode.toDataURL(uploadUrl, { margin: 1, width: 260 });
    return NextResponse.json({
      upload_url: uploadUrl,
      qr_data_url: qrDataUrl,
      expires_at: issued.expiresAt,
      ttl_minutes: issued.ttlMinutes
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

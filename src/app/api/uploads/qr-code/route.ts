import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getLocalIp } from "@/lib/network";
import { issueUploadToken } from "@/lib/qrTokens";

export const runtime = "nodejs";

function resolveBaseUrl(request: Request, hostOverride?: string) {
  const envHost = process.env.SKINPRO_QR_HOST?.trim();
  if (envHost) {
    return envHost.startsWith("http") ? envHost : `http://${envHost}`;
  }

  if (hostOverride) {
    return hostOverride.startsWith("http") ? hostOverride : `http://${hostOverride}`;
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
    const hostOverride = url.searchParams.get("host") ?? undefined;

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
    const baseUrl = resolveBaseUrl(request, hostOverride);
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

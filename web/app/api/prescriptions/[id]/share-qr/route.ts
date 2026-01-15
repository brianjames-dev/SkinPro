import { NextResponse } from "next/server";
import QRCode from "qrcode";
import fs from "fs";
import { getDb } from "@/lib/db";
import { loadSkinproPaths } from "@/lib/skinproPaths";
import { isPathWithin } from "@/lib/fileUtils";
import { issueShareToken } from "@/lib/shareTokens";
import { getLocalIp } from "@/lib/network";

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

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const prescriptionId = Number(params.id);
  if (!Number.isFinite(prescriptionId)) {
    return NextResponse.json(
      { error: "Invalid prescription id" },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    const row = db
      .prepare("SELECT file_path FROM prescriptions WHERE id = ?")
      .get(prescriptionId) as { file_path?: string } | undefined;

    if (!row?.file_path) {
      return NextResponse.json(
        { error: "Prescription not found" },
        { status: 404 }
      );
    }

    const paths = loadSkinproPaths();
    if (!isPathWithin(paths.dataDir, row.file_path)) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    if (!fs.existsSync(row.file_path)) {
      return NextResponse.json(
        { error: "File missing" },
        { status: 404 }
      );
    }

    const issued = issueShareToken(prescriptionId);
    const baseUrl = resolveBaseUrl(request, undefined);
    const shareUrl = `${baseUrl}/prescriptions/share?token=${issued.token}`;
    const qrDataUrl = await QRCode.toDataURL(shareUrl, { margin: 1, width: 260 });

    return NextResponse.json({
      share_url: shareUrl,
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

import fs from "fs";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { loadSkinproPaths } from "@/lib/skinproPaths";
import { isPathWithin } from "@/lib/fileUtils";
import { getShareToken, markShareTokenUsed } from "@/lib/shareTokens";
import { renderPdfToPng } from "@/lib/renderPdfToPng";

export const runtime = "nodejs";

const isPngBuffer = (buffer: Buffer) =>
  buffer.length >= 8 &&
  buffer[0] === 0x89 &&
  buffer[1] === 0x50 &&
  buffer[2] === 0x4e &&
  buffer[3] === 0x47 &&
  buffer[4] === 0x0d &&
  buffer[5] === 0x0a &&
  buffer[6] === 0x1a &&
  buffer[7] === 0x0a;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  try {
    console.log("[share-image] request", { token: token.slice(0, 6) });
    const shareToken = getShareToken(token);
    if (!shareToken) {
      console.warn("[share-image] invalid or expired token");
      return NextResponse.json(
        { error: "Share link is invalid or expired" },
        { status: 404 }
      );
    }

    const db = getDb();
    const row = db
      .prepare("SELECT file_path FROM prescriptions WHERE id = ?")
      .get(shareToken.prescriptionId) as { file_path?: string } | undefined;

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
      return NextResponse.json({ error: "File missing" }, { status: 404 });
    }

    const pngBuffer = await renderPdfToPng(row.file_path, 2);
    if (!isPngBuffer(pngBuffer)) {
      throw new Error("Rendered output is not a PNG");
    }

    markShareTokenUsed(token);

    return new NextResponse(pngBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename=\"prescription-${shareToken.prescriptionId}.png\"`,
        "Cache-Control": "no-store",
        "Content-Length": `${pngBuffer.length}`
      }
    });
  } catch (error) {
    console.error("[share-image] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

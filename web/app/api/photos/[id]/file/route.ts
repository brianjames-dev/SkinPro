import { NextResponse } from "next/server";
import fs from "fs";
import { getDb } from "@/lib/db";
import { loadSkinproPaths } from "@/lib/skinproPaths";
import { getContentType, isPathWithin } from "@/lib/fileUtils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const photoId = Number(params.id);
  if (!Number.isFinite(photoId)) {
    return NextResponse.json({ error: "Invalid photo id" }, { status: 400 });
  }

  try {
    const db = getDb();
    const photo = db
      .prepare("SELECT file_path FROM photos WHERE id = ?")
      .get(photoId) as { file_path?: string | null } | undefined;

    if (!photo?.file_path) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const paths = loadSkinproPaths();
    if (!isPathWithin(paths.dataDir, photo.file_path)) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    if (!fs.existsSync(photo.file_path)) {
      return NextResponse.json({ error: "File missing" }, { status: 404 });
    }

    const buffer = fs.readFileSync(photo.file_path);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": getContentType(photo.file_path)
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

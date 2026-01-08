import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDb } from "@/lib/db";
import { loadSkinproPaths } from "@/lib/skinproPaths";
import { safeClientName } from "@/lib/clientAssets";
import { normalizeImageOrientation } from "@/lib/imageProcessing";
import {
  ensureDir,
  getContentType,
  guessExtension,
  sanitizeFileName,
  isPathWithin
} from "@/lib/fileUtils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const clientId = Number(params.id);
  if (!Number.isFinite(clientId)) {
    return NextResponse.json(
      { error: "Invalid client id" },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    const client = db
      .prepare("SELECT profile_picture FROM clients WHERE id = ?")
      .get(clientId) as { profile_picture?: string | null } | undefined;

    if (!client?.profile_picture) {
      return NextResponse.json(
        { error: "Profile picture not found" },
        { status: 404 }
      );
    }

    const paths = loadSkinproPaths();
    if (!isPathWithin(paths.dataDir, client.profile_picture)) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    if (!fs.existsSync(client.profile_picture)) {
      return NextResponse.json(
        { error: "Profile picture missing" },
        { status: 404 }
      );
    }

    const buffer = fs.readFileSync(client.profile_picture);
    const stats = fs.statSync(client.profile_picture);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": getContentType(client.profile_picture),
        "Last-Modified": stats.mtime.toUTCString(),
        "X-File-Mtime": String(stats.mtimeMs)
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function HEAD(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const clientId = Number(params.id);
  if (!Number.isFinite(clientId)) {
    return NextResponse.json(
      { error: "Invalid client id" },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    const client = db
      .prepare("SELECT profile_picture FROM clients WHERE id = ?")
      .get(clientId) as { profile_picture?: string | null } | undefined;

    if (!client?.profile_picture) {
      return NextResponse.json(
        { error: "Profile picture not found" },
        { status: 404 }
      );
    }

    const paths = loadSkinproPaths();
    if (!isPathWithin(paths.dataDir, client.profile_picture)) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    if (!fs.existsSync(client.profile_picture)) {
      return NextResponse.json(
        { error: "Profile picture missing" },
        { status: 404 }
      );
    }

    const stats = fs.statSync(client.profile_picture);
    return new NextResponse(null, {
      headers: {
        "Content-Type": getContentType(client.profile_picture),
        "Last-Modified": stats.mtime.toUTCString(),
        "X-File-Mtime": String(stats.mtimeMs)
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const clientId = Number(params.id);
  if (!Number.isFinite(clientId)) {
    return NextResponse.json(
      { error: "Invalid client id" },
      { status: 400 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("photo");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No photo uploaded" },
        { status: 400 }
      );
    }

    const db = getDb();
    const client = db
      .prepare("SELECT full_name, profile_picture FROM clients WHERE id = ?")
      .get(clientId) as
      | { full_name?: string | null; profile_picture?: string | null }
      | undefined;

    if (!client?.full_name) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const paths = loadSkinproPaths();
    ensureDir(paths.profilePicturesDir);

    const ext = guessExtension(file.name, file.type);
    const safeName = sanitizeFileName(safeClientName(client.full_name));
    const baseName = `${safeName}_id_${clientId}`;
    const targetPath = path.join(paths.profilePicturesDir, `${baseName}${ext}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    const rotated = await normalizeImageOrientation(buffer);
    await fs.promises.writeFile(targetPath, rotated);

    if (
      client.profile_picture &&
      client.profile_picture !== targetPath &&
      isPathWithin(paths.dataDir, client.profile_picture)
    ) {
      if (fs.existsSync(client.profile_picture)) {
        fs.rmSync(client.profile_picture, { force: true });
      }
    }

    db.prepare("UPDATE clients SET profile_picture = ? WHERE id = ?").run(
      targetPath,
      clientId
    );

    return NextResponse.json({ profile_picture: targetPath });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

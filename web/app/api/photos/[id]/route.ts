import { NextResponse } from "next/server";
import fs from "fs";
import { getDb } from "@/lib/db";
import { loadSkinproPaths } from "@/lib/skinproPaths";
import { isPathWithin } from "@/lib/fileUtils";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const photoId = Number(params.id);
  if (!Number.isFinite(photoId)) {
    return NextResponse.json({ error: "Invalid photo id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const description =
      typeof body.description === "string" ? body.description : null;

    const db = getDb();
    const result = db
      .prepare("UPDATE photos SET description = ? WHERE id = ?")
      .run(description, photoId);

    if (result.changes === 0) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const photo = db
      .prepare(
        "SELECT id, client_id, appointment_id, appt_date, file_path, type, description FROM photos WHERE id = ?"
      )
      .get(photoId);

    return NextResponse.json({ photo });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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
      .prepare(
        "SELECT id, appointment_id, file_path FROM photos WHERE id = ?"
      )
      .get(photoId) as
      | { id: number; appointment_id?: number | null; file_path?: string | null }
      | undefined;

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    const paths = loadSkinproPaths();
    if (photo.file_path && isPathWithin(paths.dataDir, photo.file_path)) {
      if (fs.existsSync(photo.file_path)) {
        fs.rmSync(photo.file_path, { force: true });
      }
    }

    db.prepare("DELETE FROM photos WHERE id = ?").run(photoId);

    if (photo.appointment_id) {
      const remaining = db
        .prepare("SELECT COUNT(*) AS count FROM photos WHERE appointment_id = ?")
        .get(photo.appointment_id) as { count: number };

      if (remaining.count === 0) {
        db.prepare("UPDATE appointments SET photos_taken = 'No' WHERE id = ?").run(
          photo.appointment_id
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDb } from "@/lib/db";
import { loadSkinproPaths } from "@/lib/skinproPaths";
import { safeClientName } from "@/lib/clientAssets";
import { normalizeImageOrientation } from "@/lib/imageProcessing";
import { PHOTO_UPLOAD_LIMITS, validateImageFiles } from "@/lib/uploadValidation";
import {
  ensureDir,
  guessExtension,
  sanitizeFileName,
  uniqueFilePath
} from "@/lib/fileUtils";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clientIdParam = url.searchParams.get("client_id");
    const appointmentIdParam = url.searchParams.get("appointment_id");

    const db = getDb();

    const conditions: string[] = [];
    const values: unknown[] = [];

    if (clientIdParam) {
      const clientId = Number(clientIdParam);
      if (!Number.isFinite(clientId)) {
        return NextResponse.json(
          { error: "Invalid client_id" },
          { status: 400 }
        );
      }
      conditions.push("client_id = ?");
      values.push(clientId);
    }

    if (appointmentIdParam) {
      const appointmentId = Number(appointmentIdParam);
      if (!Number.isFinite(appointmentId)) {
        return NextResponse.json(
          { error: "Invalid appointment_id" },
          { status: 400 }
        );
      }
      conditions.push("appointment_id = ?");
      values.push(appointmentId);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const rows = (
      db
        .prepare(
          `SELECT id, client_id, appointment_id, appt_date, file_path, type, description
           FROM photos ${whereClause}
           ORDER BY appt_date DESC, id DESC`
        )
        .all(...values) as Record<string, unknown>[]
    ).map((row) => ({
      ...row,
      file_url: `/api/photos/${row.id as number}/file`
    }));

    return NextResponse.json({ photos: rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const clientId = Number(formData.get("client_id"));
    const appointmentId = Number(formData.get("appointment_id"));
    const description =
      typeof formData.get("description") === "string"
        ? (formData.get("description") as string)
        : "";

    if (!Number.isFinite(clientId) || !Number.isFinite(appointmentId)) {
      return NextResponse.json(
        { error: "client_id and appointment_id are required" },
        { status: 400 }
      );
    }

    const files = formData.getAll("photos");
    const fileEntries = files.filter((entry): entry is File => entry instanceof File);
    const validation = validateImageFiles(fileEntries, PHOTO_UPLOAD_LIMITS);
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const db = getDb();

    const client = db
      .prepare("SELECT full_name FROM clients WHERE id = ?")
      .get(clientId) as { full_name?: string } | undefined;

    if (!client?.full_name) {
      return NextResponse.json(
        { error: "Client not found" },
        { status: 404 }
      );
    }

    const appointment = db
      .prepare(
        "SELECT date, type FROM appointments WHERE id = ? AND client_id = ?"
      )
      .get(appointmentId, clientId) as
      | { date?: string; type?: string }
      | undefined;

    if (!appointment?.date) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    const paths = loadSkinproPaths();
    const safeName = safeClientName(client.full_name);
    const formattedDate = appointment.date.replace(/\//g, "-");
    const targetDir = path.join(
      paths.photosDir,
      `${safeName}_id_${clientId}`,
      formattedDate
    );

    ensureDir(targetDir);

    const inserted: Record<string, unknown>[] = [];

    let failedCount = 0;
    for (const entry of fileEntries) {

      const ext = guessExtension(entry.name, entry.type);
      const base = sanitizeFileName(path.basename(entry.name, ext) || "photo");
      const targetPath = uniqueFilePath(targetDir, base, ext.toLowerCase());

      const arrayBuffer = await entry.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      let rotated: Buffer;
      try {
        rotated = await normalizeImageOrientation(buffer, { strict: true });
      } catch {
        failedCount += 1;
        continue;
      }

      await fs.promises.writeFile(targetPath, rotated);

      const result = db
        .prepare(
          "INSERT INTO photos (client_id, appointment_id, appt_date, file_path, type, description) " +
            "VALUES (?, ?, ?, ?, ?, ?)"
        )
        .run(
          clientId,
          appointmentId,
          appointment.date,
          targetPath,
          appointment.type ?? null,
          description || ""
        );

      inserted.push({
        id: result.lastInsertRowid,
        file_path: targetPath,
        file_url: `/api/photos/${result.lastInsertRowid}/file`
      });
    }

    if (inserted.length === 0) {
      return NextResponse.json(
        { error: "No supported files were detected." },
        { status: 400 }
      );
    }

    if (inserted.length > 0) {
      db.prepare("UPDATE appointments SET photos_taken = 'Yes' WHERE id = ?").run(
        appointmentId
      );
    }

    return NextResponse.json({
      uploaded: inserted.length,
      failed: failedCount,
      photos: inserted
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

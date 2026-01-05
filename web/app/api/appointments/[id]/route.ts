import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const appointmentId = Number(params.id);
  if (!Number.isFinite(appointmentId)) {
    return NextResponse.json(
      { error: "Invalid appointment id" },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    const appointment = db
      .prepare(
        "SELECT id, client_id, date, type, treatment, price, photos_taken, " +
          "treatment_notes FROM appointments WHERE id = ?"
      )
      .get(appointmentId);

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ appointment });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const appointmentId = Number(params.id);
  if (!Number.isFinite(appointmentId)) {
    return NextResponse.json(
      { error: "Invalid appointment id" },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const allowedFields = [
      "date",
      "type",
      "treatment",
      "price",
      "photos_taken",
      "treatment_notes"
    ] as const;

    const updates: string[] = [];
    const values: unknown[] = [];

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        updates.push(`${field} = ?`);
        values.push(body[field] ?? null);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No fields provided to update" },
        { status: 400 }
      );
    }

    const db = getDb();
    const result = db
      .prepare(`UPDATE appointments SET ${updates.join(", ")} WHERE id = ?`)
      .run(...values, appointmentId);

    if (result.changes === 0) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    const appointment = db
      .prepare(
        "SELECT id, client_id, date, type, treatment, price, photos_taken, " +
          "treatment_notes FROM appointments WHERE id = ?"
      )
      .get(appointmentId);

    return NextResponse.json({ appointment });
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
  const appointmentId = Number(params.id);
  if (!Number.isFinite(appointmentId)) {
    return NextResponse.json(
      { error: "Invalid appointment id" },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    const appointment = db
      .prepare("SELECT id FROM appointments WHERE id = ?")
      .get(appointmentId);

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    const photoRows = db
      .prepare("SELECT file_path FROM photos WHERE appointment_id = ?")
      .all(appointmentId) as { file_path: string }[];

    const foldersToCheck = new Set<string>();
    for (const row of photoRows) {
      if (!row.file_path) {
        continue;
      }

      if (fs.existsSync(row.file_path)) {
        try {
          fs.rmSync(row.file_path, { force: true });
          foldersToCheck.add(path.dirname(row.file_path));
        } catch (err) {
          console.warn(`Failed to delete photo: ${row.file_path}`, err);
        }
      }
    }

    for (const folder of foldersToCheck) {
      try {
        if (fs.existsSync(folder) && fs.readdirSync(folder).length === 0) {
          fs.rmdirSync(folder);
        }
      } catch (err) {
        console.warn(`Failed to delete folder: ${folder}`, err);
      }
    }

    const deleteTx = db.transaction(() => {
      db.prepare("DELETE FROM photos WHERE appointment_id = ?").run(
        appointmentId
      );
      db.prepare("DELETE FROM appointments WHERE id = ?").run(appointmentId);
    });

    deleteTx();

    return NextResponse.json({ ok: true, deletedPhotos: photoRows.length });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

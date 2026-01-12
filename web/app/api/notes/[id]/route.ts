import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureNotesTable } from "@/lib/api/ensureTables";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const noteId = Number(params.id);
  if (!Number.isFinite(noteId)) {
    return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as {
      date_seen?: string;
      notes?: string;
      done_at?: string | null;
    };

    ensureNotesTable();
    const db = getDb();
    const existing = db
      .prepare(
        "SELECT id, client_id, date_seen, notes, done_at, created_at FROM client_notes WHERE id = ?"
      )
      .get(noteId) as
      | {
          id: number;
          client_id: number;
          date_seen: string;
          notes: string;
          done_at?: string | null;
          created_at: string;
        }
      | undefined;

    if (!existing) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    const dateSeen =
      typeof body.date_seen === "string" ? body.date_seen.trim() : existing.date_seen;
    const notes = typeof body.notes === "string" ? body.notes.trim() : existing.notes;
    const doneAt = Object.prototype.hasOwnProperty.call(body, "done_at")
      ? body.done_at ?? null
      : existing.done_at ?? null;

    db.prepare(
      "UPDATE client_notes SET date_seen = ?, notes = ?, done_at = ? WHERE id = ?"
    ).run(dateSeen, notes, doneAt, noteId);

    const note = db
      .prepare(
        "SELECT id, client_id, date_seen, notes, done_at, created_at FROM client_notes WHERE id = ?"
      )
      .get(noteId);

    return NextResponse.json({ note });
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
  const noteId = Number(params.id);
  if (!Number.isFinite(noteId)) {
    return NextResponse.json({ error: "Invalid note id" }, { status: 400 });
  }

  try {
    ensureNotesTable();
    const db = getDb();
    const existing = db
      .prepare("SELECT id FROM client_notes WHERE id = ?")
      .get(noteId) as { id?: number } | undefined;

    if (!existing) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    db.prepare("DELETE FROM client_notes WHERE id = ?").run(noteId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

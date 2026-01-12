import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureNotesTable } from "@/lib/api/ensureTables";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clientIdParam = url.searchParams.get("client_id");

    if (!clientIdParam) {
      return NextResponse.json(
        { error: "client_id is required" },
        { status: 400 }
      );
    }

    const clientId = Number(clientIdParam);
    if (!Number.isFinite(clientId)) {
      return NextResponse.json(
        { error: "Invalid client_id" },
        { status: 400 }
      );
    }

    ensureNotesTable();
    const db = getDb();
    const notes = db
      .prepare(
        "SELECT id, client_id, date_seen, notes, done_at, created_at " +
          "FROM client_notes WHERE client_id = ? ORDER BY created_at DESC, id DESC"
      )
      .all(clientId);

    return NextResponse.json({ notes });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      client_id?: number;
      date_seen?: string;
      notes?: string;
    };

    const clientId = Number(body.client_id);
    if (!Number.isFinite(clientId)) {
      return NextResponse.json(
        { error: "client_id is required" },
        { status: 400 }
      );
    }

    const dateSeen = typeof body.date_seen === "string" ? body.date_seen.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    if (!dateSeen || !notes) {
      return NextResponse.json(
        { error: "date_seen and notes are required" },
        { status: 400 }
      );
    }

    ensureNotesTable();
    const db = getDb();
    const createdAt = new Date().toISOString();

    const result = db
      .prepare(
        "INSERT INTO client_notes (client_id, date_seen, notes, done_at, created_at) " +
          "VALUES (?, ?, ?, ?, ?)"
      )
      .run(clientId, dateSeen, notes, null, createdAt);

    const note = db
      .prepare(
        "SELECT id, client_id, date_seen, notes, done_at, created_at " +
          "FROM client_notes WHERE id = ?"
      )
      .get(result.lastInsertRowid);

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

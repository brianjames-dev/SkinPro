import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const isValidDate = (value: string) => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    return false;
  }
  const [month, day, year] = value.split("/").map(Number);
  if (!month || !day || !year) {
    return false;
  }
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
};

const ensureMaintenanceTable = () => {
  const db = getDb();
  db.prepare(
    "CREATE TABLE IF NOT EXISTS maintenance (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
      "client_id INTEGER NOT NULL, " +
      "last_talked_date TEXT NOT NULL, " +
      "notes TEXT, " +
      "FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE" +
      ")"
  ).run();
  return db;
};

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const entryId = Number(params.id);
    if (!Number.isFinite(entryId)) {
      return NextResponse.json({ error: "Invalid maintenance id" }, { status: 400 });
    }

    const body = (await request.json()) as {
      last_talked_date?: string;
      notes?: string;
    };
    const lastTalked = body.last_talked_date?.trim() ?? "";

    if (!lastTalked || !isValidDate(lastTalked)) {
      return NextResponse.json(
        { error: "last_talked_date must be in MM/DD/YYYY format" },
        { status: 400 }
      );
    }

    const notes = body.notes?.trim() ?? "";
    const db = ensureMaintenanceTable();

    const result = db
      .prepare(
        "UPDATE maintenance SET last_talked_date = ?, notes = ? WHERE id = ?"
      )
      .run(lastTalked, notes, entryId);

    if (result.changes === 0) {
      return NextResponse.json(
        { error: "Maintenance entry not found" },
        { status: 404 }
      );
    }

    const entry = db
      .prepare(
        `SELECT m.id, m.client_id, c.full_name, c.primary_phone,
                m.last_talked_date, m.notes
         FROM maintenance m
         JOIN clients c ON m.client_id = c.id
         WHERE m.id = ?`
      )
      .get(entryId);

    return NextResponse.json({ maintenance: entry });
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
  try {
    const entryId = Number(params.id);
    if (!Number.isFinite(entryId)) {
      return NextResponse.json({ error: "Invalid maintenance id" }, { status: 400 });
    }

    const db = ensureMaintenanceTable();
    const result = db.prepare("DELETE FROM maintenance WHERE id = ?").run(entryId);

    if (result.changes === 0) {
      return NextResponse.json(
        { error: "Maintenance entry not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

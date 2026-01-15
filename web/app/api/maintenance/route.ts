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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clientIdParam = url.searchParams.get("client_id");

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
      conditions.push("m.client_id = ?");
      values.push(clientId);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const db = ensureMaintenanceTable();
    const rows = db
      .prepare(
        `SELECT m.id, m.client_id, c.full_name, c.primary_phone,
                m.last_talked_date, m.notes
         FROM maintenance m
         JOIN clients c ON m.client_id = c.id
         ${whereClause}
         ORDER BY m.last_talked_date ASC`
      )
      .all(...values);

    return NextResponse.json({ maintenance: rows });
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
      last_talked_date?: string;
      notes?: string;
    };

    const clientId = Number(body.client_id);
    if (!Number.isFinite(clientId)) {
      return NextResponse.json(
        { error: "client_id is required" },
        { status: 400 }
      );
    }

    const lastTalked = body.last_talked_date?.trim() ?? "";
    if (!lastTalked || !isValidDate(lastTalked)) {
      return NextResponse.json(
        { error: "last_talked_date must be in MM/DD/YYYY format" },
        { status: 400 }
      );
    }

    const db = ensureMaintenanceTable();
    const client = db
      .prepare("SELECT full_name, primary_phone FROM clients WHERE id = ?")
      .get(clientId) as { full_name?: string; primary_phone?: string } | undefined;

    if (!client?.full_name) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    if (!client.primary_phone) {
      return NextResponse.json(
        { error: "Client is missing a primary phone number" },
        { status: 400 }
      );
    }

    const notes = body.notes?.trim() ?? "";

    const result = db
      .prepare(
        "INSERT INTO maintenance (client_id, last_talked_date, notes) VALUES (?, ?, ?)"
      )
      .run(clientId, lastTalked, notes);

    const entry = db
      .prepare(
        `SELECT m.id, m.client_id, c.full_name, c.primary_phone,
                m.last_talked_date, m.notes
         FROM maintenance m
         JOIN clients c ON m.client_id = c.id
         WHERE m.id = ?`
      )
      .get(result.lastInsertRowid);

    return NextResponse.json({ maintenance: entry }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

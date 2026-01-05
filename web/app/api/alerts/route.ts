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
      conditions.push("a.client_id = ?");
      values.push(clientId);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const db = getDb();
    const rows = db
      .prepare(
        `SELECT a.id, a.client_id, c.full_name, c.primary_phone, a.deadline, a.notes
         FROM alerts a
         JOIN clients c ON a.client_id = c.id
         ${whereClause}
         ORDER BY a.deadline ASC`
      )
      .all(...values);

    return NextResponse.json({ alerts: rows });
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
      deadline?: string;
      notes?: string;
    };

    const clientId = Number(body.client_id);
    if (!Number.isFinite(clientId)) {
      return NextResponse.json(
        { error: "client_id is required" },
        { status: 400 }
      );
    }

    const deadline = body.deadline?.trim() ?? "";
    if (!deadline || !isValidDate(deadline)) {
      return NextResponse.json(
        { error: "deadline must be in MM/DD/YYYY format" },
        { status: 400 }
      );
    }

    const db = getDb();
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
      .prepare("INSERT INTO alerts (client_id, deadline, notes) VALUES (?, ?, ?)")
      .run(clientId, deadline, notes);

    const alert = db
      .prepare(
        `SELECT a.id, a.client_id, c.full_name, c.primary_phone, a.deadline, a.notes
         FROM alerts a
         JOIN clients c ON a.client_id = c.id
         WHERE a.id = ?`
      )
      .get(result.lastInsertRowid);

    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const clientIdParam = url.searchParams.get("client_id");
    const limitParam = Number(url.searchParams.get("limit") ?? "200");
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 500)
      : 200;

    const db = getDb();

    if (clientIdParam) {
      const clientId = Number(clientIdParam);
      if (!Number.isFinite(clientId)) {
        return NextResponse.json(
          { error: "Invalid client_id" },
          { status: 400 }
        );
      }

      const rows = db
        .prepare(
          "SELECT id, client_id, date, type, treatment, price, photos_taken, " +
            "treatment_notes FROM appointments WHERE client_id = ? " +
            "ORDER BY date DESC"
        )
        .all(clientId);

      return NextResponse.json({ appointments: rows });
    }

    const rows = db
      .prepare(
        "SELECT id, client_id, date, type, treatment, price, photos_taken, " +
          "treatment_notes FROM appointments ORDER BY date DESC LIMIT ?"
      )
      .all(limit);

    return NextResponse.json({ appointments: rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const clientId = Number(body.client_id);
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const type = typeof body.type === "string" ? body.type.trim() : "";

    if (!Number.isFinite(clientId) || !date || !type) {
      return NextResponse.json(
        { error: "client_id, date, and type are required" },
        { status: 400 }
      );
    }

    const payload = {
      client_id: clientId,
      date,
      type,
      treatment: body.treatment ?? null,
      price: body.price ?? null,
      photos_taken: body.photos_taken ?? "No",
      treatment_notes: body.treatment_notes ?? null
    };

    const db = getDb();
    const result = db
      .prepare(
        "INSERT INTO appointments (client_id, date, type, treatment, price, " +
          "photos_taken, treatment_notes) " +
          "VALUES (@client_id, @date, @type, @treatment, @price, " +
          "@photos_taken, @treatment_notes)"
      )
      .run(payload);

    const appointment = db
      .prepare(
        "SELECT id, client_id, date, type, treatment, price, photos_taken, " +
          "treatment_notes FROM appointments WHERE id = ?"
      )
      .get(result.lastInsertRowid);

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitParam = Number(url.searchParams.get("limit") ?? "25");
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 10000)
      : 25;
    const query = url.searchParams.get("q")?.trim();

    const db = getDb();

    const rows = query
      ? db
          .prepare(
            "SELECT id, full_name, gender, birthdate, primary_phone, email, " +
              "address1, address2, city, state, zip, referred_by " +
              "FROM clients WHERE full_name LIKE ? " +
              "ORDER BY full_name LIMIT ?"
          )
          .all(`%${query}%`, limit)
      : db
          .prepare(
            "SELECT id, full_name, gender, birthdate, primary_phone, email, " +
              "address1, address2, city, state, zip, referred_by " +
              "FROM clients ORDER BY full_name LIMIT ?"
          )
          .all(limit);

    return NextResponse.json({ clients: rows });
  } catch (error) {
    return NextResponse.json(
      {
        clients: [],
        error: error instanceof Error ? error.message : "Unexpected error"
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const fullName = typeof body.full_name === "string" ? body.full_name.trim() : "";

    if (!fullName) {
      return NextResponse.json(
        { error: "full_name is required" },
        { status: 400 }
      );
    }

    const db = getDb();

    const payload = {
      full_name: fullName,
      gender: body.gender ?? null,
      birthdate: body.birthdate ?? null,
      primary_phone: body.primary_phone ?? null,
      secondary_phone: body.secondary_phone ?? null,
      email: body.email ?? null,
      address1: body.address1 ?? null,
      address2: body.address2 ?? null,
      city: body.city ?? null,
      state: body.state ?? null,
      zip: body.zip ?? null,
      referred_by: body.referred_by ?? null,
      profile_picture: body.profile_picture ?? null
    };

    const result = db
      .prepare(
        "INSERT INTO clients (full_name, gender, birthdate, primary_phone, " +
          "secondary_phone, email, address1, address2, city, state, zip, " +
          "referred_by, profile_picture) " +
          "VALUES (@full_name, @gender, @birthdate, @primary_phone, " +
          "@secondary_phone, @email, @address1, @address2, @city, @state, " +
          "@zip, @referred_by, @profile_picture)"
      )
      .run(payload);

    const client = db
      .prepare("SELECT * FROM clients WHERE id = ?")
      .get(result.lastInsertRowid);

    return NextResponse.json({ client }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

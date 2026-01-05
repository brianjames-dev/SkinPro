import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const HEALTH_FIELDS = [
  "allergies",
  "health_conditions",
  "health_risks",
  "medications",
  "treatment_areas",
  "current_products",
  "skin_conditions",
  "other_notes",
  "desired_improvement"
] as const;

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const clientId = Number(params.id);
  if (!Number.isFinite(clientId)) {
    return NextResponse.json(
      { error: "Invalid client id" },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    const health = db
      .prepare("SELECT * FROM client_health_info WHERE client_id = ?")
      .get(clientId);

    return NextResponse.json({ health });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const clientId = Number(params.id);
  if (!Number.isFinite(clientId)) {
    return NextResponse.json(
      { error: "Invalid client id" },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    const client = db
      .prepare("SELECT id FROM clients WHERE id = ?")
      .get(clientId);

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const payload: Record<string, unknown> = {};

    for (const field of HEALTH_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        payload[field] = body[field] ?? null;
      }
    }

    const existing = db
      .prepare("SELECT id FROM client_health_info WHERE client_id = ?")
      .get(clientId) as { id: number } | undefined;

    if (existing?.id) {
      const updates = Object.keys(payload).map((field) => `${field} = ?`);
      const values = Object.values(payload);

      if (updates.length > 0) {
        db.prepare(
          `UPDATE client_health_info SET ${updates.join(", ")} WHERE client_id = ?`
        ).run(...values, clientId);
      }
    } else {
      db.prepare(
        "INSERT INTO client_health_info (client_id, allergies, health_conditions, " +
          "health_risks, medications, treatment_areas, current_products, " +
          "skin_conditions, other_notes, desired_improvement) " +
          "VALUES (@client_id, @allergies, @health_conditions, @health_risks, " +
          "@medications, @treatment_areas, @current_products, @skin_conditions, " +
          "@other_notes, @desired_improvement)"
      ).run({ client_id: clientId, ...payload });
    }

    const health = db
      .prepare("SELECT * FROM client_health_info WHERE client_id = ?")
      .get(clientId);

    return NextResponse.json({ health });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

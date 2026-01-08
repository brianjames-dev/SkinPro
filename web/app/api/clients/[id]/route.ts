import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { deleteClientAssets } from "@/lib/clientAssets";

export const runtime = "nodejs";

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
    const client = db
      .prepare("SELECT * FROM clients WHERE id = ?")
      .get(clientId);

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const health = db
      .prepare("SELECT * FROM client_health_info WHERE client_id = ?")
      .get(clientId);

    return NextResponse.json({ client, health });
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
  const clientId = Number(params.id);
  if (!Number.isFinite(clientId)) {
    return NextResponse.json(
      { error: "Invalid client id" },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const allowedFields = [
      "full_name",
      "gender",
      "birthdate",
      "primary_phone",
      "secondary_phone",
      "email",
      "address1",
      "address2",
      "city",
      "state",
      "zip",
      "referred_by",
      "profile_picture"
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
      .prepare(`UPDATE clients SET ${updates.join(", ")} WHERE id = ?`)
      .run(...values, clientId);

    if (result.changes === 0) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const client = db
      .prepare("SELECT * FROM clients WHERE id = ?")
      .get(clientId);

    return NextResponse.json({ client });
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
  const clientId = Number(params.id);
  if (!Number.isFinite(clientId)) {
    return NextResponse.json(
      { error: "Invalid client id" },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    db.prepare(
      "CREATE TABLE IF NOT EXISTS client_products (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
        "client_id INTEGER NOT NULL, " +
        "date TEXT NOT NULL, " +
        "product TEXT NOT NULL, " +
        "size TEXT, " +
        "cost TEXT, " +
        "brand TEXT" +
        ")"
    ).run();
    const client = db
      .prepare("SELECT full_name, profile_picture FROM clients WHERE id = ?")
      .get(clientId) as { full_name?: string; profile_picture?: string | null } | undefined;

    if (!client?.full_name) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const deleteTx = db.transaction(() => {
      db.prepare("DELETE FROM photos WHERE client_id = ?").run(clientId);
      db.prepare("DELETE FROM prescriptions WHERE client_id = ?").run(clientId);
      db.prepare("DELETE FROM appointments WHERE client_id = ?").run(clientId);
      db.prepare("DELETE FROM client_products WHERE client_id = ?").run(clientId);
      db.prepare("DELETE FROM alerts WHERE client_id = ?").run(clientId);
      db.prepare("DELETE FROM client_health_info WHERE client_id = ?").run(clientId);
      db.prepare("DELETE FROM client_images WHERE client_id = ?").run(clientId);
      db.prepare("DELETE FROM clients WHERE id = ?").run(clientId);
    });

    deleteTx();

    const assets = deleteClientAssets({
      clientId,
      fullName: client.full_name,
      profilePicturePath: client.profile_picture ?? null
    });

    return NextResponse.json({ ok: true, assets });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

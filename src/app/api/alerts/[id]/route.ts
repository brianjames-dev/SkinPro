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

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const alertId = Number(params.id);
    if (!Number.isFinite(alertId)) {
      return NextResponse.json({ error: "Invalid alert id" }, { status: 400 });
    }

    const body = (await request.json()) as { deadline?: string; notes?: string };
    const deadline = body.deadline?.trim() ?? "";

    if (!deadline || !isValidDate(deadline)) {
      return NextResponse.json(
        { error: "deadline must be in MM/DD/YYYY format" },
        { status: 400 }
      );
    }

    const notes = body.notes?.trim() ?? "";
    const db = getDb();

    const result = db
      .prepare("UPDATE alerts SET deadline = ?, notes = ? WHERE id = ?")
      .run(deadline, notes, alertId);

    if (result.changes === 0) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    const alert = db
      .prepare(
        `SELECT a.id, a.client_id, c.full_name, c.primary_phone, a.deadline, a.notes
         FROM alerts a
         JOIN clients c ON a.client_id = c.id
         WHERE a.id = ?`
      )
      .get(alertId);

    return NextResponse.json({ alert });
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
    const alertId = Number(params.id);
    if (!Number.isFinite(alertId)) {
      return NextResponse.json({ error: "Invalid alert id" }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare("DELETE FROM alerts WHERE id = ?").run(alertId);

    if (result.changes === 0) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

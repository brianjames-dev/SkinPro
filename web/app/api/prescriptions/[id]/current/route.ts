import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureCurrentPrescriptionColumn } from "../../utils";

export const runtime = "nodejs";

export async function PATCH(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const prescriptionId = Number(params.id);
  if (!Number.isFinite(prescriptionId)) {
    return NextResponse.json(
      { error: "Invalid prescription id" },
      { status: 400 }
    );
  }

  try {
    const db = getDb();
    ensureCurrentPrescriptionColumn(db);

    const existing = db
      .prepare("SELECT id, client_id FROM prescriptions WHERE id = ?")
      .get(prescriptionId) as { id: number; client_id: number } | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: "Prescription not found" },
        { status: 404 }
      );
    }

    db.prepare("UPDATE prescriptions SET is_current = 0 WHERE client_id = ?").run(
      existing.client_id
    );
    db.prepare("UPDATE prescriptions SET is_current = 1 WHERE id = ?").run(
      prescriptionId
    );

    const prescription = db
      .prepare(
        "SELECT id, client_id, appointment_id, start_date, form_type, file_path, is_current " +
          "FROM prescriptions WHERE id = ?"
      )
      .get(prescriptionId);

    return NextResponse.json({ prescription });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

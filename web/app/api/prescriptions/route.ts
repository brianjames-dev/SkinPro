import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { generatePrescriptionPdf } from "@/lib/prescriptions/generatePrescription";
import { ensureCurrentPrescriptionColumn } from "./utils";

export const runtime = "nodejs";

type StepsDict = {
  start_date?: string;
  [key: string]: unknown;
};

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

    const db = getDb();
    ensureCurrentPrescriptionColumn(db);
    const rows = (
      db
        .prepare(
          "SELECT id, client_id, appointment_id, start_date, form_type, file_path, is_current " +
            "FROM prescriptions WHERE client_id = ? ORDER BY start_date DESC"
        )
        .all(clientId) as Record<string, unknown>[]
    ).map((row) => ({
      ...row,
      file_url: `/api/prescriptions/${row.id as number}/file`
    }));

    return NextResponse.json({ prescriptions: rows });
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
      appointment_id?: number | null;
      start_date?: string;
      data?: StepsDict;
    };

    const clientId = Number(body.client_id);
    if (!Number.isFinite(clientId)) {
      return NextResponse.json(
        { error: "client_id is required" },
        { status: 400 }
      );
    }

    const steps = body.data ?? {};
    const startDate =
      typeof body.start_date === "string"
        ? body.start_date
        : steps.start_date;

    if (!startDate) {
      return NextResponse.json(
        { error: "start_date is required" },
        { status: 400 }
      );
    }

    steps.start_date = startDate;

    const db = getDb();
    const client = db
      .prepare("SELECT full_name FROM clients WHERE id = ?")
      .get(clientId) as { full_name?: string } | undefined;

    if (!client?.full_name) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const { filePath, formType } = await generatePrescriptionPdf({
      clientId,
      clientName: client.full_name,
      steps
    });

    const result = db
      .prepare(
        "INSERT INTO prescriptions (client_id, appointment_id, start_date, form_type, file_path, data_json) " +
          "VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(
        clientId,
        body.appointment_id ?? null,
        startDate,
        formType,
        filePath,
        JSON.stringify(steps)
      );

    const prescription = db
      .prepare(
        "SELECT id, client_id, appointment_id, start_date, form_type, file_path FROM prescriptions WHERE id = ?"
      )
      .get(result.lastInsertRowid);

    return NextResponse.json({ prescription }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

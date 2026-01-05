import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { loadSkinproPaths } from "@/lib/skinproPaths";
import { isPathWithin } from "@/lib/fileUtils";
import { generatePrescriptionPdf } from "@/lib/prescriptions/generatePrescription";

export const runtime = "nodejs";

type StepsDict = {
  start_date?: string;
  [key: string]: unknown;
};

export async function GET(
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
    const prescription = db
      .prepare(
        "SELECT id, client_id, appointment_id, start_date, form_type, file_path, data_json " +
          "FROM prescriptions WHERE id = ?"
      )
      .get(prescriptionId) as
      | {
          id: number;
          client_id: number;
          appointment_id?: number | null;
          start_date?: string;
          form_type?: string;
          file_path?: string;
          data_json?: string;
        }
      | undefined;

    if (!prescription) {
      return NextResponse.json(
        { error: "Prescription not found" },
        { status: 404 }
      );
    }

    const data = prescription.data_json ? JSON.parse(prescription.data_json) : null;
    return NextResponse.json({
      prescription: {
        ...prescription,
        data
      }
    });
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
  const prescriptionId = Number(params.id);
  if (!Number.isFinite(prescriptionId)) {
    return NextResponse.json(
      { error: "Invalid prescription id" },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json()) as {
      start_date?: string;
      data?: StepsDict;
    };

    const db = getDb();
    const existing = db
      .prepare(
        "SELECT id, client_id, start_date, file_path, data_json FROM prescriptions WHERE id = ?"
      )
      .get(prescriptionId) as
      | {
          id: number;
          client_id: number;
          start_date?: string;
          file_path?: string;
          data_json?: string;
        }
      | undefined;

    if (!existing) {
      return NextResponse.json(
        { error: "Prescription not found" },
        { status: 404 }
      );
    }

    const steps = body.data ??
      (existing.data_json ? (JSON.parse(existing.data_json) as StepsDict) : {});

    if (body.start_date) {
      steps.start_date = body.start_date;
    }

    const client = db
      .prepare("SELECT full_name FROM clients WHERE id = ?")
      .get(existing.client_id) as { full_name?: string } | undefined;

    if (!client?.full_name) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const { filePath, formType, startDate } = await generatePrescriptionPdf({
      clientId: existing.client_id,
      clientName: client.full_name,
      steps
    });

    if (existing.file_path && existing.file_path !== filePath) {
      const paths = loadSkinproPaths();
      if (isPathWithin(paths.dataDir, existing.file_path) && fs.existsSync(existing.file_path)) {
        fs.rmSync(existing.file_path, { force: true });
        const folder = path.dirname(existing.file_path);
        if (fs.existsSync(folder) && fs.readdirSync(folder).length === 0) {
          fs.rmdirSync(folder);
        }
      }
    }

    db.prepare(
      "UPDATE prescriptions SET start_date = ?, form_type = ?, file_path = ?, data_json = ? WHERE id = ?"
    ).run(startDate, formType, filePath, JSON.stringify(steps), prescriptionId);

    const prescription = db
      .prepare(
        "SELECT id, client_id, appointment_id, start_date, form_type, file_path FROM prescriptions WHERE id = ?"
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

export async function DELETE(
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
    const row = db
      .prepare("SELECT file_path FROM prescriptions WHERE id = ?")
      .get(prescriptionId) as { file_path?: string } | undefined;

    if (!row) {
      return NextResponse.json(
        { error: "Prescription not found" },
        { status: 404 }
      );
    }

    if (row.file_path) {
      const paths = loadSkinproPaths();
      if (isPathWithin(paths.dataDir, row.file_path) && fs.existsSync(row.file_path)) {
        fs.rmSync(row.file_path, { force: true });
        const folder = path.dirname(row.file_path);
        if (fs.existsSync(folder) && fs.readdirSync(folder).length === 0) {
          fs.rmdirSync(folder);
        }
      }
    }

    db.prepare("DELETE FROM prescriptions WHERE id = ?").run(prescriptionId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

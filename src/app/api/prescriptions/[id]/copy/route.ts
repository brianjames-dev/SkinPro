import path from "path";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { loadSkinproPaths } from "@/lib/skinproPaths";
import { safeClientName } from "@/lib/clientAssets";
import { ensureDir, uniqueFilePath } from "@/lib/fileUtils";
import { generatePrescriptionPdf } from "@/lib/prescriptions/generatePrescription";

export const runtime = "nodejs";

type StepsDict = {
  start_date?: string;
  [key: string]: unknown;
};

const getTodayDateString = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const year = String(now.getFullYear());
  return `${month}/${day}/${year}`;
};

function getColumnCount(steps: StepsDict): number {
  let maxCol = 0;
  for (let i = 1; i <= 4; i += 1) {
    if (steps[`Col${i}`] || steps[`Col${i}_Header`]) {
      maxCol = i;
    }
  }
  return maxCol || 2;
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const prescriptionId = Number(params.id);
    if (!Number.isFinite(prescriptionId)) {
      return NextResponse.json(
        { error: "Invalid prescription id" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      target_client_id?: number;
      start_date?: string;
    };

    const targetClientId = Number(body.target_client_id);
    if (!Number.isFinite(targetClientId)) {
      return NextResponse.json(
        { error: "target_client_id is required" },
        { status: 400 }
      );
    }

    const db = getDb();
    const source = db
      .prepare(
        "SELECT data_json FROM prescriptions WHERE id = ?"
      )
      .get(prescriptionId) as { data_json?: string | null } | undefined;

    if (!source?.data_json) {
      return NextResponse.json(
        { error: "Source prescription not found" },
        { status: 404 }
      );
    }

    let steps: StepsDict;
    try {
      steps = JSON.parse(source.data_json) as StepsDict;
    } catch {
      return NextResponse.json(
        { error: "Source prescription data is invalid" },
        { status: 400 }
      );
    }
    const startDate = body.start_date ?? steps.start_date ?? getTodayDateString();
    steps.start_date = startDate;

    const columnCount = getColumnCount(steps);
    if (columnCount < 2 || columnCount > 4) {
      return NextResponse.json(
        { error: "Unsupported column count" },
        { status: 400 }
      );
    }

    const targetClient = db
      .prepare("SELECT full_name FROM clients WHERE id = ?")
      .get(targetClientId) as { full_name?: string } | undefined;

    if (!targetClient?.full_name) {
      return NextResponse.json(
        { error: "Target client not found" },
        { status: 404 }
      );
    }

    const safeDate = startDate.replace(/\//g, "-");
    const formTypeSlug = `${columnCount}-col`;
    const paths = loadSkinproPaths();
    const safeName = safeClientName(targetClient.full_name);
    const clientDir = path.join(paths.prescriptionsDir, `${safeName}_${targetClientId}`);
    ensureDir(clientDir);

    const baseName = `${safeDate}_${formTypeSlug}`;
    const targetPath = uniqueFilePath(clientDir, baseName, ".pdf");

    const { filePath, formType } = await generatePrescriptionPdf({
      clientId: targetClientId,
      clientName: targetClient.full_name,
      steps,
      outputPath: targetPath
    });

    const result = db
      .prepare(
        "INSERT INTO prescriptions (client_id, appointment_id, start_date, form_type, file_path, data_json) " +
          "VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(
        targetClientId,
        null,
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

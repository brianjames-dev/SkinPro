import fs from "fs";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { loadSkinproPaths } from "@/lib/skinproPaths";
import { isPathWithin } from "@/lib/fileUtils";

export const runtime = "nodejs";

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
    const row = db
      .prepare("SELECT file_path FROM prescriptions WHERE id = ?")
      .get(prescriptionId) as { file_path?: string } | undefined;

    if (!row?.file_path) {
      return NextResponse.json(
        { error: "Prescription not found" },
        { status: 404 }
      );
    }

    const paths = loadSkinproPaths();
    if (!isPathWithin(paths.dataDir, row.file_path)) {
      return NextResponse.json(
        { error: "Invalid file path" },
        { status: 400 }
      );
    }

    if (!fs.existsSync(row.file_path)) {
      return NextResponse.json(
        { error: "File missing" },
        { status: 404 }
      );
    }

    const buffer = fs.readFileSync(row.file_path);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

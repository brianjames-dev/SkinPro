import { NextResponse } from "next/server";
import {
  loadPrescriptionTemplates,
  savePrescriptionTemplates
} from "@/lib/prescriptions/templates";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const templateId = params.id;
    if (!templateId) {
      return NextResponse.json({ error: "Template id is required" }, { status: 400 });
    }

    const templates = loadPrescriptionTemplates();
    const next = templates.filter((template) => template.id !== templateId);

    if (next.length === templates.length) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    savePrescriptionTemplates(next);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import {
  loadPrescriptionTemplates,
  savePrescriptionTemplates
} from "@/lib/prescriptions/templates";

export const runtime = "nodejs";

type StepsDict = {
  start_date?: string;
  [key: string]: unknown;
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

export async function GET() {
  try {
    const templates = loadPrescriptionTemplates();
    return NextResponse.json({ templates });
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
      name?: string;
      steps?: StepsDict;
    };

    const name = body.name?.trim();
    if (!name) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }

    const steps = body.steps ?? {};
    const sanitizedSteps = { ...steps, start_date: "" };
    const columnCount = getColumnCount(sanitizedSteps);

    if (columnCount < 2 || columnCount > 4) {
      return NextResponse.json(
        { error: "Templates must be between 2 and 4 columns" },
        { status: 400 }
      );
    }

    const templates = loadPrescriptionTemplates();
    const now = new Date().toISOString();
    const template = {
      id: randomUUID(),
      name,
      column_count: columnCount,
      steps: sanitizedSteps,
      created_at: now,
      updated_at: now
    };

    templates.unshift(template);
    savePrescriptionTemplates(templates);

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

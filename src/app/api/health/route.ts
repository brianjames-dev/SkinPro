import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { loadSkinproPaths } from "@/lib/skinproPaths";

export const runtime = "nodejs";

export async function GET() {
  try {
    const paths = loadSkinproPaths();
    const db = getDb();

    const counts = db
      .prepare(
        "SELECT (SELECT COUNT(*) FROM clients) AS clients, " +
          "(SELECT COUNT(*) FROM appointments) AS appointments, " +
          "(SELECT COUNT(*) FROM photos) AS photos, " +
          "(SELECT COUNT(*) FROM prescriptions) AS prescriptions, " +
          "(SELECT COUNT(*) FROM alerts) AS alerts"
      )
      .get();

    return NextResponse.json({
      ok: true,
      paths: {
        dataDir: paths.dataDir,
        dbPath: paths.dbPath
      },
      counts
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unexpected error"
      },
      { status: 500 }
    );
  }
}

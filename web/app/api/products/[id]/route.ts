import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureProductsTable } from "@/lib/api/ensureTables";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const productId = Number(params.id);
  if (!Number.isFinite(productId)) {
    return NextResponse.json(
      { error: "Invalid product id" },
      { status: 400 }
    );
  }

  try {
    ensureProductsTable();
    const db = getDb();
    const entry = db
      .prepare(
        "SELECT id, client_id, date, product, size, cost, brand " +
          "FROM client_products WHERE id = ?"
      )
      .get(productId);

    if (!entry) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ product: entry });
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
  const productId = Number(params.id);
  if (!Number.isFinite(productId)) {
    return NextResponse.json(
      { error: "Invalid product id" },
      { status: 400 }
    );
  }

  try {
    ensureProductsTable();
    const body = (await request.json()) as Record<string, unknown>;
    const allowedFields = [
      "date",
      "product",
      "size",
      "cost",
      "brand"
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
      .prepare(`UPDATE client_products SET ${updates.join(", ")} WHERE id = ?`)
      .run(...values, productId);

    if (result.changes === 0) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const entry = db
      .prepare(
        "SELECT id, client_id, date, product, size, cost, brand " +
          "FROM client_products WHERE id = ?"
      )
      .get(productId);

    return NextResponse.json({ product: entry });
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
  const productId = Number(params.id);
  if (!Number.isFinite(productId)) {
    return NextResponse.json(
      { error: "Invalid product id" },
      { status: 400 }
    );
  }

  try {
    ensureProductsTable();
    const db = getDb();
    const entry = db
      .prepare("SELECT id FROM client_products WHERE id = ?")
      .get(productId);

    if (!entry) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    db.prepare("DELETE FROM client_products WHERE id = ?").run(productId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

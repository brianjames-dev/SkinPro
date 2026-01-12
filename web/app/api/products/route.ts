import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureProductsTable } from "@/lib/api/ensureTables";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    ensureProductsTable();
    const url = new URL(request.url);
    const clientIdParam = url.searchParams.get("client_id");
    const limitParam = Number(url.searchParams.get("limit") ?? "200");
    const limit = Number.isFinite(limitParam)
      ? Math.min(Math.max(limitParam, 1), 500)
      : 200;

    const db = getDb();

    if (clientIdParam) {
      const clientId = Number(clientIdParam);
      if (!Number.isFinite(clientId)) {
        return NextResponse.json(
          { error: "Invalid client_id" },
          { status: 400 }
        );
      }

      const rows = db
        .prepare(
          "SELECT id, client_id, date, product, size, cost, brand " +
            "FROM client_products WHERE client_id = ? ORDER BY date DESC"
        )
        .all(clientId);

      return NextResponse.json({ products: rows });
    }

    const rows = db
      .prepare(
        "SELECT id, client_id, date, product, size, cost, brand " +
          "FROM client_products ORDER BY date DESC LIMIT ?"
      )
      .all(limit);

    return NextResponse.json({ products: rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    ensureProductsTable();
    const body = (await request.json()) as Record<string, unknown>;
    const clientId = Number(body.client_id);
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const product = typeof body.product === "string" ? body.product.trim() : "";

    if (!Number.isFinite(clientId) || !date || !product) {
      return NextResponse.json(
        { error: "client_id, date, and product are required" },
        { status: 400 }
      );
    }

    const payload = {
      client_id: clientId,
      date,
      product,
      size: body.size ?? null,
      cost: body.cost ?? null,
      brand: body.brand ?? null
    };

    const db = getDb();
    const result = db
      .prepare(
        "INSERT INTO client_products (client_id, date, product, size, cost, brand) " +
          "VALUES (@client_id, @date, @product, @size, @cost, @brand)"
      )
      .run(payload);

    const entry = db
      .prepare(
        "SELECT id, client_id, date, product, size, cost, brand " +
          "FROM client_products WHERE id = ?"
      )
      .get(result.lastInsertRowid);

    return NextResponse.json({ product: entry }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

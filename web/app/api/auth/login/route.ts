import { NextResponse } from "next/server";
import {
  getAuthCookieName,
  getAuthPin,
  issueAuthCookie
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { pin?: string };
    const pin = typeof body.pin === "string" ? body.pin.trim() : "";
    const expected = getAuthPin();

    if (!expected) {
      return NextResponse.json(
        { error: "SKINPRO_PIN is not configured." },
        { status: 500 }
      );
    }

    if (!pin || pin !== expected) {
      return NextResponse.json({ error: "Invalid PIN." }, { status: 401 });
    }

    const authCookie = await issueAuthCookie();
    const response = NextResponse.json({ ok: true });
    response.cookies.set(getAuthCookieName(), authCookie.value, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: authCookie.maxAgeSeconds
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 }
    );
  }
}

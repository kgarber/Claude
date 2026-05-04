import { NextResponse } from "next/server";
import { searchComps } from "@/lib/ebay";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: "Missing q" }, { status: 400 });
  }
  try {
    const result = await searchComps(query);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

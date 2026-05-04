import { NextResponse } from "next/server";
import { identifyItem } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image uploaded" }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Image too large (max 8MB)" }, { status: 413 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const base64 = buf.toString("base64");
    const mediaType = file.type || "image/jpeg";

    const guesses = await identifyItem(base64, mediaType);
    return NextResponse.json({ guesses });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

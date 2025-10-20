import { NextResponse } from "next/server";
import { uploadFileBase64 } from "@/lib/graph";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { fileName, contentBase64 } = await req.json();
    if (!fileName || !contentBase64) {
      return NextResponse.json({ ok: false, error: "Missing fields" }, { status: 400 });
    }
    const { url } = await uploadFileBase64(fileName, contentBase64);
    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Upload failed" }, { status: 500 });
  }
}

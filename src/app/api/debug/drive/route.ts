import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDriveItemMeta, listDriveChildren } from "@/lib/graph";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key") || "";
    const c = await cookies();
    const role = c.get("role")?.value;
    const debugKey = process.env.DEBUG_KEY || "";
    if (!(role === "SUPERVISOR" || (debugKey && key === debugKey))) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const listPath = url.searchParams.get("path") || undefined;
    const root = await listDriveChildren();
    const pathChildren = listPath ? await listDriveChildren(listPath) : [];
    const workbookPath = process.env.GRAPH_WORKBOOK_PATH || "";
    const uploadFolder = process.env.GRAPH_UPLOAD_FOLDER || "";

    let workbookMeta: any = null;
    let uploadMeta: any = null;
    let workbookError: string | undefined;
    let uploadError: string | undefined;

    if (workbookPath) {
      try {
        workbookMeta = await getDriveItemMeta(workbookPath);
      } catch (e: any) {
        workbookError = e?.message || String(e);
      }
    }
    if (uploadFolder) {
      try {
        uploadMeta = await getDriveItemMeta(uploadFolder);
      } catch (e: any) {
        uploadError = e?.message || String(e);
      }
    }

    return NextResponse.json({
      ok: true,
      rootSample: root.slice(0, 15).map((x: any) => ({ name: x.name, folder: !!x.folder, file: !!x.file })),
      path,
      pathChildren: pathChildren.map((x: any) => ({ name: x.name, folder: !!x.folder, file: !!x.file })),
      workbookPath,
      workbookMeta,
      workbookError,
      uploadFolder,
      uploadMeta,
      uploadError,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Drive debug failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTableHeaders, getTableValues, graphTables } from "@/lib/graph";

type UserRow = {
  employeeNo: string;
  name: string;
  username: string;
  email: string;
  group?: string;
};

export async function GET(req: Request) {
  try {
    const c = await cookies();
    const role = c.get("role")?.value;
    if (role !== "SUPERVISOR") {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const table = graphTables.users();
    if (!table) {
      return NextResponse.json({ ok: false, error: "Users table is not configured" }, { status: 500 });
    }

    const url = new URL(req.url);
    const groupFilter = (url.searchParams.get("group") || "").trim().toLowerCase();

    const [headers, rows] = await Promise.all([getTableHeaders(table), getTableValues(table)]);
    const idx = (name: string) => headers.findIndex((h) => String(h).trim().toLowerCase() === name.toLowerCase());
    const cols = {
      employeeNo: idx("employeeNo"),
      name: idx("name"),
      username: idx("username"),
      email: idx("email"),
      group: idx("group"),
    };

    const users: UserRow[] = rows
      .map((r) => {
        const employeeNo = cols.employeeNo >= 0 ? String(r[cols.employeeNo] || "").trim() : "";
        const name = cols.name >= 0 ? String(r[cols.name] || "").trim() : "";
        const username = cols.username >= 0 ? String(r[cols.username] || "").trim() : "";
        const email = cols.email >= 0 ? String(r[cols.email] || "").trim() : "";
        const group = cols.group >= 0 ? String(r[cols.group] || "").trim() : undefined;
        const identity = username || email;
        if (!employeeNo || !identity) return null;
        if (groupFilter && !(group || "").toLowerCase().includes(groupFilter)) return null;
        return { employeeNo, name: name || identity, username, email, group };
      })
      .filter(Boolean) as UserRow[];

    users.sort((a, b) => a.employeeNo.localeCompare(b.employeeNo, undefined, { numeric: true, sensitivity: "base" }));

    return NextResponse.json({
      ok: true,
      users: users.map((u) => ({
        employeeNo: u.employeeNo,
        name: u.name,
        username: u.username,
        email: u.email,
        group: u.group,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to list users" }, { status: 500 });
  }
}

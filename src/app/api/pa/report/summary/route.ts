import { NextResponse } from "next/server";
import { listActivities, graphTables, getTableHeaders, getTableValues } from "@/lib/graph";

type UserInfo = {
  name?: string;
  email?: string;
  employeeNo?: string;
  district?: string;
  group?: string;
};

type SummaryEntry = {
  name: string;
  email?: string;
  employeeNo?: string;
  district?: string;
  group?: string;
  total: number;
  completed: number;
  incomplete: number;
  ongoing: number;
};

function normalizeKey(value?: string | null): string | null {
  const key = (value || "").trim().toLowerCase();
  return key ? key : null;
}

async function buildUserLookup(): Promise<Map<string, UserInfo>> {
  try {
    const tbl = graphTables.users();
    const [headers, rows] = await Promise.all([getTableHeaders(tbl), getTableValues(tbl)]);
    const idx = (name: string) => headers.findIndex((h) => String(h).trim().toLowerCase() === name.toLowerCase());
    const cols = {
      email: idx("email"),
      username: idx("username"),
      name: idx("name"),
      employeeNo: idx("employeeNo"),
      district: idx("district"),
      group: idx("group"),
    };
    const map = new Map<string, UserInfo>();
    for (const row of rows) {
      const info: UserInfo = {
        name: cols.name >= 0 ? String(row[cols.name] || "").trim() : undefined,
        email: cols.email >= 0 ? String(row[cols.email] || "").trim() : undefined,
        employeeNo: cols.employeeNo >= 0 ? String(row[cols.employeeNo] || "").trim() : undefined,
        district: cols.district >= 0 ? String(row[cols.district] || "").trim() : undefined,
        group: cols.group >= 0 ? String(row[cols.group] || "").trim() : undefined,
      };
      const keys = [
        normalizeKey(cols.email >= 0 ? row[cols.email] : undefined),
        normalizeKey(cols.username >= 0 ? row[cols.username] : undefined),
        normalizeKey(info.employeeNo),
      ].filter(Boolean) as string[];
      for (const key of keys) {
        if (key && !map.has(key)) {
          map.set(key, info);
        }
      }
    }
    return map;
  } catch (err) {
    console.warn("Failed to load users table for summary", err);
    return new Map();
  }
}

function identityKey(row: { email?: string; employeeNo?: string; name?: string }): string {
  const emailKey = normalizeKey(row.email);
  const employeeKey = normalizeKey(row.employeeNo);
  const nameKey = normalizeKey(row.name);
  return emailKey ?? employeeKey ?? nameKey ?? "unknown";
}

export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => ({}))) as any;
    const { from, to, district } = raw || {};
    const [rows, userLookup] = await Promise.all([
      listActivities({ from, to, district }),
      buildUserLookup(),
    ]);

    const summaryMap = new Map<string, SummaryEntry>();
    for (const r of rows) {
      const key = identityKey(r);
      const emailKey = normalizeKey(r.email);
      const employeeKey = normalizeKey(r.employeeNo);
      const userInfo =
        (emailKey && userLookup.get(emailKey)) ||
        (employeeKey && userLookup.get(employeeKey)) ||
        null;
      let s = summaryMap.get(key);
      if (!s) {
        s = {
          name: r.name || userInfo?.name || "Unknown",
          email: r.email || userInfo?.email,
          employeeNo: r.employeeNo || userInfo?.employeeNo,
          district: r.district || userInfo?.district,
          group: r.group || userInfo?.group,
          total: 0,
          completed: 0,
          incomplete: 0,
          ongoing: 0,
        };
        summaryMap.set(key, s);
      }
      if (!s.name && (r.name || userInfo?.name)) s.name = r.name || userInfo?.name || s.name;
      if (!s.email && (r.email || userInfo?.email)) s.email = r.email || userInfo?.email;
      if (!s.employeeNo && (r.employeeNo || userInfo?.employeeNo)) s.employeeNo = r.employeeNo || userInfo?.employeeNo;
      if (!s.district && (r.district || userInfo?.district)) s.district = r.district || userInfo?.district;
      if (!s.group && (r.group || userInfo?.group)) s.group = r.group || userInfo?.group;
      s.total += 1;
      if (r.status === "completed") s.completed += 1;
      else if (r.status === "incomplete") s.incomplete += 1;
      else s.ongoing += 1;
    }

    const summary = Array.from(summaryMap.values()).map(({ email, ...rest }) => rest);
    return NextResponse.json({ ok: true, summary });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to load summary" }, { status: 500 });
  }
}

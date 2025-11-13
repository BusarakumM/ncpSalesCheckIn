import { NextResponse } from "next/server";
import { listActivities, getUsersLookup, normalizeLookupKey, type UserLookupInfo } from "@/lib/graph";

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

function identityKey(row: { email?: string; employeeNo?: string; name?: string }): string {
  const emailKey = normalizeLookupKey(row.email);
  const employeeKey = normalizeLookupKey(row.employeeNo);
  const nameKey = normalizeLookupKey(row.name);
  return emailKey ?? employeeKey ?? nameKey ?? "unknown";
}

function resolveUserInfo(
  row: { email?: string; employeeNo?: string; name?: string },
  userLookup: Map<string, UserLookupInfo>
) {
  const keys = [
    normalizeLookupKey(row.email),
    normalizeLookupKey(row.employeeNo),
    normalizeLookupKey(row.name),
  ].filter(Boolean) as string[];
  for (const key of keys) {
    const info = userLookup.get(key);
    if (info) return info;
  }
  return null;
}

export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => ({}))) as any;
    const { from, to, district, group, search } = raw || {};
    let nameFilter: string | undefined;
    let employeeFilter: string | undefined;
    if (typeof search === "string" && search.trim()) {
      const trimmed = search.trim();
      if (/^\d+$/.test(trimmed)) employeeFilter = trimmed;
      else nameFilter = trimmed;
    }
    const [rows, userLookup] = await Promise.all([
      listActivities({
        from,
        to,
        district,
        group,
        name: nameFilter,
        employeeNo: employeeFilter,
      }),
      getUsersLookup(),
    ]);

    const summaryMap = new Map<string, SummaryEntry>();
    for (const r of rows) {
      const key = identityKey(r);
      const userInfo = resolveUserInfo(r, userLookup);
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

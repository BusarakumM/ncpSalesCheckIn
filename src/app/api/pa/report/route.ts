import { NextResponse } from "next/server";
import { getUsersLookup, listActivities, normalizeLookupKey, type UserLookupInfo } from "@/lib/graph";
import { cookies } from "next/headers";
import { buildServerCacheKey, getOrSetServerCache, serverCacheNamespaces } from "@/lib/serverCache";

const AGENT_MAX_DAYS = 7;

function getBangkokIsoDate() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  return `${year}-${month}-${day}`;
}

function shiftIsoDate(iso: string, days: number) {
  const base = new Date(`${iso}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function clampIsoDate(iso: string, minIso: string, maxIso: string) {
  if (!iso) return "";
  if (iso < minIso) return minIso;
  if (iso > maxIso) return maxIso;
  return iso;
}

function normalizeAgentRange(from?: string, to?: string) {
  const max = getBangkokIsoDate();
  const min = shiftIsoDate(max, -(AGENT_MAX_DAYS - 1));
  let nextFrom = clampIsoDate(String(from || ""), min, max) || min;
  let nextTo = clampIsoDate(String(to || ""), min, max) || max;
  if (nextFrom > nextTo) {
    nextTo = nextFrom;
  }
  return { from: nextFrom, to: nextTo };
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
    const { from, to, name, location, district, group } = raw || {};
    const c = cookies();
    const role = (await c).get("role")?.value;
    const cookieIdentity = (await c).get("username")?.value || (await c).get("email")?.value;
    const email = role === "SUPERVISOR" ? (raw?.email || raw?.username || undefined) : (cookieIdentity || undefined);
    const effectiveRange = role === "SUPERVISOR" ? { from, to } : normalizeAgentRange(from, to);
    const listArgs = {
      from: effectiveRange.from,
      to: effectiveRange.to,
      name,
      email,
      includeRowIndexes: true,
      district: role === "SUPERVISOR" ? (district || undefined) : undefined,
      group: role === "SUPERVISOR" ? (group || undefined) : undefined,
      location: location || undefined,
    };

    const cacheKey = buildServerCacheKey(serverCacheNamespaces.report, {
      role: role || "",
      identity: email || "",
      filters: {
        from: effectiveRange.from || "",
        to: effectiveRange.to || "",
        name: name || "",
        location: location || "",
        district: district || "",
        group: group || "",
      },
    });

    const payload = await getOrSetServerCache(cacheKey, 45_000, async () => {
      let rows = await listActivities(listArgs);
      // Reuse one users lookup instead of reading the Users table for every row.
      try {
        const userLookup = await getUsersLookup();
        for (const r of rows) {
          const info = resolveUserInfo(r, userLookup);
          if (!info) continue;
          if (!(r as any).group && info.group) (r as any).group = info.group;
          if (!(r as any).district && info.district) (r as any).district = info.district;
          if (!(r as any).name && info.name) (r as any).name = info.name;
          if (!(r as any).employeeNo && info.employeeNo) (r as any).employeeNo = info.employeeNo;
        }
        if (role === "SUPERVISOR" && group) {
          const g = String(group).toLowerCase();
          rows = rows.filter((r: any) => String(r.group || "").toLowerCase().includes(g));
        }
      } catch {}
      return { ok: true as const, rows };
    });

    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to load report" }, { status: 500 });
  }
}

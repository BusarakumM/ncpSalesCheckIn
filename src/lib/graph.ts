/*
  Microsoft Graph helper for server-side routes.

  Requires the following environment variables:
  - AZURE_TENANT_ID (or GRAPH_TENANT_ID)
  - AZURE_CLIENT_ID (or GRAPH_CLIENT_ID)
  - AZURE_CLIENT_SECRET (or GRAPH_CLIENT_SECRET)
  - GRAPH_SITE_ID                         e.g.  contoso.sharepoint.com,1234-... (full siteId)
  - GRAPH_WORKBOOK_PATH                   e.g.  Shared Documents/Attendance.xlsx
  - GRAPH_UPLOAD_FOLDER (optional)        e.g.  Shared Documents/Photos

  Per-feature table names (create them in the workbook with matching columns):
  - GRAPH_TBL_CHECKIN
  - GRAPH_TBL_CHECKOUT
  - GRAPH_TBL_LEAVE
*/

const GRAPH_BASE = "https://graph.microsoft.com/v1.0" as const;

type Token = { access_token: string; expires_in: number };

let cachedToken: { token: string; exp: number } | null = null;
const headerCache = new Map<string, string[]>();

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

function encodePath(p: string): string {
  const noLead = p.replace(/^\/+/, "");
  return noLead
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

async function getAccessToken(): Promise<string> {
  const tenant = process.env.GRAPH_TENANT_ID || process.env.AZURE_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID || process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET;
  const scope = "https://graph.microsoft.com/.default";

  if (!tenant || !clientId || !clientSecret) {
    throw new Error("Missing Graph/Azure AD credentials (tenant/clientId/clientSecret)");
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp - 60 > now) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope,
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Token error ${res.status}: ${txt}`);
  }
  const data = (await res.json()) as Token;
  cachedToken = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return data.access_token;
}

async function graphFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  const url = path.startsWith("http") ? path : `${GRAPH_BASE}${path}`;
  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

function workbookBasePath(): string {
  const siteId = env("GRAPH_SITE_ID");
  const workbookPath = encodePath(env("GRAPH_WORKBOOK_PATH"));
  return `/sites/${siteId}/drive/root:/${workbookPath}:/workbook`;
}

export async function uploadFileBase64(fileName: string, contentBase64: string): Promise<{ url: string; id: string }> {
  const siteId = env("GRAPH_SITE_ID");
  const folder = process.env.GRAPH_UPLOAD_FOLDER ? encodePath(process.env.GRAPH_UPLOAD_FOLDER) : encodePath("Shared Documents/Uploads");
  const clean = contentBase64.includes(",") ? contentBase64.split(",")[1] : contentBase64;
  const buf = Buffer.from(clean, "base64");

  const path = `/sites/${siteId}/drive/root:/${folder}/${encodeURIComponent(fileName)}:/content`;
  const r = await graphFetch(path, { method: "PUT", body: buf });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Upload failed ${r.status}: ${txt}`);
  }
  const data = (await r.json()) as any;
  return { url: (data.webUrl as string) || (data["@microsoft.graph.downloadUrl"] as string), id: data.id as string };
}

export async function addRowToTable(tableName: string, rowValues: any[]): Promise<void> {
  const base = workbookBasePath();
  const path = `${base}/tables/${encodeURIComponent(tableName)}/rows/add`;
  const body = { values: [rowValues] };
  const r = await graphFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Add row failed ${r.status}: ${txt}`);
  }
}

async function getTableHeaders(tableName: string): Promise<string[]> {
  if (headerCache.has(tableName)) return headerCache.get(tableName)!;
  const base = workbookBasePath();
  const path = `${base}/tables/${encodeURIComponent(tableName)}/headerRowRange`;
  const r = await graphFetch(path);
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Read headers failed ${r.status}: ${txt}`);
  }
  const data = (await r.json()) as any; // { values: [ [h1, h2, ...] ] }
  const headers = (data?.values?.[0] as string[])?.map((h) => String(h).trim()) || [];
  headerCache.set(tableName, headers);
  return headers;
}

export async function addRowToTableByObject(tableName: string, data: Record<string, any>): Promise<void> {
  const headers = await getTableHeaders(tableName);
  const values = headers.map((h) => (data[h] ?? ""));
  await addRowToTable(tableName, values);
}

export const graphTables = {
  checkin: () => env("GRAPH_TBL_CHECKIN"),
  checkout: () => env("GRAPH_TBL_CHECKOUT"),
  leave: () => env("GRAPH_TBL_LEAVE"),
  users: () => env("GRAPH_TBL_USERS"),
  holidays: () => env("GRAPH_TBL_HOLIDAYS"),
  weeklyOff: () => env("GRAPH_TBL_WEEKLY_OFF"),
  // Optional table for soft-deletes of leave rows. If env is not set, defaults to
  // a table named "LeaveDeletes". If the table does not exist, readers ignore it.
  leaveDeletes: () => env("GRAPH_TBL_LEAVE_DELETES", "LeaveDeletes"),
  dayoffs: () => env("GRAPH_TBL_DAYOFFS"),
};

// Read entire table values (excludes header row)
export async function getTableValues(tableName: string): Promise<string[][]> {
  const base = workbookBasePath();
  const path = `${base}/tables/${encodeURIComponent(tableName)}/range`;
  const r = await graphFetch(path);
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Read table failed ${r.status}: ${txt}`);
  }
  const data = (await r.json()) as any; // { values: any[][] }
  const values = (data?.values as any[][]) || [];
  if (values.length === 0) return [];
  // First row is header; skip
  return values.slice(1) as string[][];
}

export type ActivityRow = {
  date: string; // yyyy-mm-dd
  checkin?: string; // HH:mm or ISO
  checkout?: string; // HH:mm or ISO
  location: string;
  checkinLocation?: string;
  checkoutLocation?: string;
  detail?: string;
  status: "completed" | "incomplete" | "ongoing";
  name?: string;
  email?: string;
  imageIn?: string;
  imageOut?: string;
  district?: string;
  checkinGps?: string;
  checkoutGps?: string;
  checkinAddress?: string;
  checkoutAddress?: string;
  checkinLat?: number;
  checkinLon?: number;
  checkoutLat?: number;
  checkoutLon?: number;
  distanceKm?: number;
  issues?: string[]; // server-side flags for diagnostics
};

function toDatePart(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toTimePart(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mi}`;
}

export async function listActivities(params: { from?: string; to?: string; name?: string; email?: string; district?: string; location?: string }): Promise<ActivityRow[]> {
  const tCheckin = graphTables.checkin();
  const tCheckout = graphTables.checkout();
  const [ciHeaders, ciRows, coHeaders, coRows] = await Promise.all([
    getTableHeaders(tCheckin),
    getTableValues(tCheckin),
    getTableHeaders(tCheckout),
    getTableValues(tCheckout),
  ]);

  type Key = string;
  // We separate tasks by datetime (check-in time) rather than location.
  const keyOfCheckin = (email: string, date: string, time: string) => `${email || ''}|${date}|${time || ''}`;

  function findIdx(headers: string[], name: string, fallback: number | null): number | null {
    const i = headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    return i >= 0 ? i : fallback;
  }
  function findIdentityIdx(headers: string[], fallback: number | null): number | null {
    const u = headers.findIndex((h) => h.toLowerCase() === "username");
    if (u >= 0) return u;
    const e = headers.findIndex((h) => h.toLowerCase() === "email");
    return e >= 0 ? e : fallback;
  }
  const idx = {
    ci: {
      iso: findIdx(ciHeaders, "checkinISO", 0),
      location: findIdx(ciHeaders, "locationName", 1),
      gps: findIdx(ciHeaders, "gps", 2),
      address: findIdx(ciHeaders, "checkinAddress", null),
      lat: findIdx(ciHeaders, "checkinLat", null),
      lon: findIdx(ciHeaders, "checkinLon", null),
      title: findIdx(ciHeaders, "jobTitle", 3),
      detail: findIdx(ciHeaders, "jobDetail", 4),
      photo: findIdx(ciHeaders, "photoUrl", 5),
      email: findIdentityIdx(ciHeaders, 6),
      name: findIdx(ciHeaders, "name", 7),
      district: findIdx(ciHeaders, "district", 12),
    },
    co: {
      iso: findIdx(coHeaders, "checkoutISO", 0),
      location: findIdx(coHeaders, "locationName", 1),
      gps: findIdx(coHeaders, "checkoutGps", 2),
      address: findIdx(coHeaders, "checkoutAddress", null),
      lat: findIdx(coHeaders, "checkoutLat", null),
      lon: findIdx(coHeaders, "checkoutLon", null),
      photo: findIdx(coHeaders, "checkoutPhotoUrl", 3),
      email: findIdentityIdx(coHeaders, 4),
      name: findIdx(coHeaders, "name", 5),
      district: findIdx(coHeaders, "district", 10),
    },
  };

  const map = new Map<Key, ActivityRow>();

  function normalizeLatLon(lat?: number, lon?: number): { lat: number; lon: number } | undefined {
    if (lat == null || lon == null) return undefined;
    if (!isFinite(lat) || !isFinite(lon)) return undefined;
    // If latitude is out of range but longitude looks like a latitude, swap them
    if (Math.abs(lat) > 90 && Math.abs(lon) <= 90) {
      const t = lat; lat = lon; lon = t;
    }
    // Reject invalid coordinates
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
    return { lat, lon };
  }

  function parseGps(s?: string): { lat: number; lon: number } | undefined {
    if (!s) return undefined;
    const m = String(s).trim().split(/\s*,\s*/);
    if (m.length !== 2) return undefined;
    const lat = Number(m[0]);
    const lon = Number(m[1]);
    return normalizeLatLon(lat, lon);
  }

  function getMaxDistanceKm(): number | undefined {
    const raw = process.env.MAX_DISTANCE_KM ?? process.env.NEXT_PUBLIC_MAX_DISTANCE_KM;
    if (!raw) return undefined;
    const n = Number(raw);
    return isFinite(n) && n > 0 ? n : undefined;
  }

  function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
    const R = 6371; // Earth radius in km
    const dLat = (b.lat - a.lat) * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLon / 2);
    const aa = s1 * s1 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * s2 * s2;
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
    return Math.round(R * c * 1000) / 1000; // 3 decimals
  }

  for (const r of ciRows) {
    const iso = String(idx.ci.iso != null ? r[idx.ci.iso] || "" : "");
    const date = toDatePart(iso);
    const time = toTimePart(iso);
    const location = String(idx.ci.location != null ? r[idx.ci.location] || "" : "");
    const email = String(idx.ci.email != null ? r[idx.ci.email] || "" : "");
    const name = String(idx.ci.name != null ? r[idx.ci.name] || "" : "");
    const key = keyOfCheckin(email, date, time);
    const gpsStr = idx.ci.gps != null ? String(r[idx.ci.gps] || "") : "";
    const parsed = idx.ci.lat != null && idx.ci.lon != null
      ? normalizeLatLon(Number(r[idx.ci.lat]), Number(r[idx.ci.lon]))
      : parseGps(gpsStr);
    map.set(key, {
      date,
      checkin: time,
      location,
      checkinLocation: location,
      detail: String(idx.ci.detail != null ? r[idx.ci.detail] || "" : ""),
      status: "ongoing",
      name,
      email,
      imageIn: String(idx.ci.photo != null ? r[idx.ci.photo] || "" : ""),
      district: String(idx.ci.district != null ? r[idx.ci.district] || "" : ""),
      checkinGps: gpsStr,
      checkinAddress: String(idx.ci.address != null ? r[idx.ci.address] || "" : ""),
      checkinLat: parsed?.lat,
      checkinLon: parsed?.lon,
      issues: (!parsed && gpsStr) ? ["invalid_checkin_gps"] : [],
    });
    if (!parsed && gpsStr) {
      console.warn("Invalid check-in GPS", { key, gps: gpsStr });
    }
  }

  for (const r of coRows) {
    const iso = String(idx.co.iso != null ? r[idx.co.iso] || "" : "");
    const date = toDatePart(iso);
    const time = toTimePart(iso);
    const location = String(idx.co.location != null ? r[idx.co.location] || "" : "");
    const email = String(idx.co.email != null ? r[idx.co.email] || "" : "");
    const name = String(idx.co.name != null ? r[idx.co.name] || "" : "");
    // Try to attach this checkout to the most recent ongoing check-in on the same date for this user.
    // Prefer same location if available.
    let key: Key | null = null;
    let bestIdx: Key | null = null;
    let bestScore = -1;
    for (const [k, row] of map.entries()) {
      if (row.email === email && row.date === date && row.checkin && !row.checkout) {
        // score: prefer same location then closest time gap (if checkin available)
        let score = 0;
        if ((row.location || row.checkinLocation || '') === (location || '')) score += 10;
        const ci = row.checkin || '';
        const toMinutes = (hhmm: string) => {
          const [hh, mm] = hhmm.split(":");
          return Number(hh) * 60 + Number(mm);
        };
        const ciMin = ci ? toMinutes(ci) : 0;
        const coMin = time ? toMinutes(time) : 0;
        const gap = ci && time ? Math.max(0, coMin - ciMin) : 0;
        // smaller gap is better
        score += Math.max(0, 500 - gap);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = k;
        }
      }
    }
    if (bestIdx) key = bestIdx;
    // If nothing to attach, fall back to its own key by checkout time
    if (!key) key = keyOfCheckin(email, date, time);
    const gpsStr = idx.co.gps != null ? String(r[idx.co.gps] || "") : "";
    const parsed = idx.co.lat != null && idx.co.lon != null
      ? normalizeLatLon(Number(r[idx.co.lat]), Number(r[idx.co.lon]))
      : parseGps(gpsStr);
    const row = map.get(key);
    if (row) {
      row.checkout = time;
      row.status = row.checkin ? "completed" : "incomplete";
      row.checkoutLocation = location || row.checkoutLocation;
      row.imageOut = String(idx.co.photo != null ? r[idx.co.photo] || "" : "");
      if (!row.name) row.name = name;
      if (!row.email) row.email = email;
      if (!row.district) row.district = String(idx.co.district != null ? r[idx.co.district] || "" : "");
      row.checkoutGps = gpsStr;
      row.checkoutAddress = String(idx.co.address != null ? r[idx.co.address] || "" : "");
      row.checkoutLat = parsed?.lat;
      row.checkoutLon = parsed?.lon;
      if (!parsed && gpsStr) {
        row.issues = Array.isArray(row.issues) ? [...row.issues, "invalid_checkout_gps"] : ["invalid_checkout_gps"];
        console.warn("Invalid check-out GPS", { key, gps: gpsStr });
      }
      if (row.checkinLat != null && row.checkinLon != null && row.checkoutLat != null && row.checkoutLon != null) {
        const d = haversineKm({ lat: row.checkinLat, lon: row.checkinLon }, { lat: row.checkoutLat, lon: row.checkoutLon });
        const cap = getMaxDistanceKm();
        if (cap != null && d > cap) {
          row.issues = Array.isArray(row.issues) ? [...row.issues, "distance_over_threshold"] : ["distance_over_threshold"];
          console.warn("Distance exceeds cap", { key, distanceKm: d, cap, from: { lat: row.checkinLat, lon: row.checkinLon }, to: { lat: row.checkoutLat, lon: row.checkoutLon } });
        }
        row.distanceKm = d;
      }
    } else {
      map.set(key, {
        date,
        checkout: time,
        location,
        checkoutLocation: location,
        status: "incomplete",
        name,
        email,
        imageOut: String(idx.co.photo != null ? r[idx.co.photo] || "" : ""),
        district: String(idx.co.district != null ? r[idx.co.district] || "" : ""),
        checkoutGps: gpsStr,
        checkoutAddress: String(idx.co.address != null ? r[idx.co.address] || "" : ""),
        checkoutLat: parsed?.lat,
        checkoutLon: parsed?.lon,
        issues: (!parsed && gpsStr) ? ["invalid_checkout_gps"] : [],
      });
      if (!parsed && gpsStr) {
        console.warn("Invalid check-out GPS", { key, gps: gpsStr });
      }
    }
  }

  let rows = Array.from(map.values());

  // Filter
  if (params.from) {
    const f = new Date(params.from);
    rows = rows.filter((r) => new Date(r.date) >= f);
  }
  if (params.to) {
    const t = new Date(params.to);
    rows = rows.filter((r) => new Date(r.date) <= t);
  }
  if (params.name) {
    const n = params.name.toLowerCase();
    rows = rows.filter((r) => (r.name || "").toLowerCase().includes(n));
  }
  if (params.email) {
    const e = params.email.toLowerCase();
    rows = rows.filter((r) => (r.email || "").toLowerCase() === e);
  }
  if (params.district) {
    const d = params.district.toLowerCase();
    rows = rows.filter((r) => (r.district || "").toLowerCase().includes(d));
  }
  if (params.location) {
    const l = params.location.toLowerCase();
    rows = rows.filter((r) => (r.location || "").toLowerCase().includes(l));
  }

  // Order by date ASC then name ASC for readability
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.name || '').localeCompare(b.name || '')));
  return rows;
}

export async function healthCheckGraph() {
  // Token
  const token = await getAccessToken();
  const ok: { token: boolean; workbook: boolean; tables: Record<string, boolean>; uploadFolder: boolean } = {
    token: !!token,
    workbook: false,
    tables: {},
    uploadFolder: false,
  };

  // Workbook base
  const base = workbookBasePath();
  const wb = await graphFetch(`${base}`);
  ok.workbook = wb.ok;

  // Tables
  for (const [k, getter] of Object.entries(graphTables)) {
    try {
      const t = getter as () => string;
      const name = t();
      await getTableValues(name);
      ok.tables[k] = true;
    } catch {
      ok.tables[k] = false;
    }
  }

  // Upload folder
  try {
    const siteId = env("GRAPH_SITE_ID");
    const folder = process.env.GRAPH_UPLOAD_FOLDER ? encodePath(process.env.GRAPH_UPLOAD_FOLDER) : encodePath("Shared Documents/Uploads");
    const meta = await graphFetch(`/sites/${siteId}/drive/root:/${folder}`);
    ok.uploadFolder = meta.ok;
  } catch {
    ok.uploadFolder = false;
  }
  return ok;
}

// Look up a user from the Users table by identity (case-insensitive).
// Supports either a `username` or `email` column; prefers `username` if present.
export async function findUserByEmail(identity: string): Promise<{
  email: string; // returns the matched identity (username or email) in this field for compatibility
  role?: "SUPERVISOR" | "AGENT" | string;
  name?: string;
  employeeNo?: string;
  supervisorEmail?: string;
  province?: string;
  channel?: string;
  district?: string;
} | null> {
  const table = graphTables.users();
  const [headers, rows] = await Promise.all([getTableHeaders(table), getTableValues(table)]);
  const idx = (name: string) => headers.findIndex((h) => String(h).trim().toLowerCase() === name.toLowerCase());
  const cols = {
    email: idx("email"),
    username: idx("username"),
    role: idx("role"),
    name: idx("name"),
    employeeNo: idx("employeeNo"),
    supervisorEmail: idx("supervisorEmail"),
    province: idx("province"),
    channel: idx("channel"),
    district: idx("district"),
  };
  const target = identity.trim().toLowerCase();
  for (const r of rows) {
    const userVal = cols.username >= 0 ? String(r[cols.username] || "").trim() : "";
    const emailVal = cols.email >= 0 ? String(r[cols.email] || "").trim() : "";
    const idLower = (userVal || emailVal).trim().toLowerCase();
    if (!idLower) continue;
    if (idLower === target) {
      return {
        // For backward compatibility, expose the matched identity in `email`
        email: (userVal || emailVal) || "",
        role: cols.role >= 0 ? (String(r[cols.role] || "").trim() as any) : undefined,
        name: cols.name >= 0 ? String(r[cols.name] || "").trim() : undefined,
        employeeNo: cols.employeeNo >= 0 ? String(r[cols.employeeNo] || "").trim() : undefined,
        supervisorEmail: cols.supervisorEmail >= 0 ? String(r[cols.supervisorEmail] || "").trim() : undefined,
        province: cols.province >= 0 ? String(r[cols.province] || "").trim() : undefined,
        channel: cols.channel >= 0 ? String(r[cols.channel] || "").trim() : undefined,
        district: cols.district >= 0 ? String(r[cols.district] || "").trim() : undefined,
      };
    }
  }
  return null;
}

// ---- Debug/drive helpers ----
export async function listDriveChildren(path?: string) {
  const siteId = env("GRAPH_SITE_ID");
  const base = path
    ? `/sites/${siteId}/drive/root:/${encodePath(path)}:/children`
    : `/sites/${siteId}/drive/root/children`;
  const r = await graphFetch(base);
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Drive list failed ${r.status}: ${txt}`);
  }
  const data = (await r.json()) as any;
  return Array.isArray(data?.value) ? data.value : [];
}

export async function getDriveItemMeta(path: string) {
  const siteId = env("GRAPH_SITE_ID");
  const url = `/sites/${siteId}/drive/root:/${encodePath(path)}`;
  const r = await graphFetch(url);
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`Drive item failed ${r.status}: ${txt}`);
  }
  return (await r.json()) as any;
}

// Company holidays: [dateISO, name, type, description]
export async function listHolidays(from?: string, to?: string): Promise<Array<{ date: string; name: string; type?: string; description?: string }>> {
  const tbl = graphTables.holidays();
  const [headers, rows] = await Promise.all([getTableHeaders(tbl), getTableValues(tbl)]);
  const idx = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const id = { date: idx("dateISO"), name: idx("name"), type: idx("type"), description: idx("description") };
  function parseDateAny(v: any): Date | null {
    if (v == null) return null;
    // Excel serial number (days since 1899-12-30)
    if (typeof v === 'number' && isFinite(v)) {
      const base = Date.UTC(1899, 11, 30);
      return new Date(base + Math.round(v) * 86400000);
    }
    const s = String(v).trim();
    if (!s) return null;
    // ISO or locale-parseable
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }
    // dd/mm/yyyy
    const m = s.match(/^([0-3]?\d)\/([0-1]?\d)\/(\d{4})$/);
    if (m) {
      const dd = parseInt(m[1], 10), mm = parseInt(m[2], 10) - 1, yyyy = parseInt(m[3], 10);
      const d = new Date(Date.UTC(yyyy, mm, dd));
      return isNaN(d.getTime()) ? null : d;
    }
    // mm/dd/yyyy
    const m2 = s.match(/^([0-1]?\d)\/([0-3]?\d)\/(\d{4})$/);
    if (m2) {
      const mm = parseInt(m2[1], 10) - 1, dd = parseInt(m2[2], 10), yyyy = parseInt(m2[3], 10);
      const d = new Date(Date.UTC(yyyy, mm, dd));
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function toISODate(d: Date | null): string {
    if (!d) return "";
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  let items = rows.map((r) => {
    const rawDate = id.date >= 0 ? (r[id.date] as any) : (r[0] as any);
    const parsed = parseDateAny(rawDate);
    return {
      date: parsed ? toISODate(parsed) : String(rawDate || ""),
      name: String(id.name >= 0 ? r[id.name] : r[1] || ""),
      type: id.type >= 0 ? String(r[id.type] || "") : "",
      description: id.description >= 0 ? String(r[id.description] || "") : "",
      _dt: parsed,
    } as any;
  });
  if (from) {
    const f = new Date(from);
    items = items.filter((x: any) => (x._dt ? x._dt >= f : false));
  }
  if (to) {
    const t = new Date(to);
    items = items.filter((x: any) => (x._dt ? x._dt <= t : false));
  }
  items.sort((a: any, b: any) => ((a._dt?.getTime() || 0) - (b._dt?.getTime() || 0)));
  return items.map(({ _dt, ...rest }: any) => rest);
}

// Day-offs table: [email, dateISO, leaveType, remark, by, createdAt]
export async function addDayOff(row: { employeeNo?: string; email?: string; dateISO: string; leaveType: string; remark?: string; by?: string; username?: string }): Promise<void> {
  const tbl = graphTables.dayoffs();
  const payload = {
    employeeNo: row.employeeNo ?? "",
    // write both fields to support either table header name
    email: row.email ?? row.username ?? "",
    username: row.username ?? row.email ?? "",
    dateISO: row.dateISO,
    leaveType: row.leaveType,
    remark: row.remark ?? "",
    by: row.by ?? "",
    createdAt: new Date().toISOString(),
  };
  await addRowToTableByObject(tbl, payload);
}

export async function listDayOffs(params: { from?: string; to?: string; email?: string; employeeNo?: string }): Promise<Array<{ employeeNo?: string; email?: string; date: string; leaveType: string; remark?: string }>> {
  const tbl = graphTables.dayoffs();
  const [headers, rows] = await Promise.all([getTableHeaders(tbl), getTableValues(tbl)]);
  const idx = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const id = { employeeNo: idx("employeeNo"), email: ((): number => { const u = idx("username"); return u >= 0 ? u : idx("email"); })(), date: idx("dateISO"), leaveType: idx("leaveType"), remark: idx("remark") };
  let items = rows.map((r) => ({
    employeeNo: id.employeeNo >= 0 ? String(r[id.employeeNo] || "") : "",
    email: id.email >= 0 ? String(r[id.email] || "") : "",
    date: id.date >= 0 ? String(r[id.date] || "") : "",
    leaveType: id.leaveType >= 0 ? String(r[id.leaveType] || "") : "",
    remark: id.remark >= 0 ? String(r[id.remark] || "") : "",
  }));
  if (params.employeeNo) items = items.filter((x) => (x.employeeNo || "").toLowerCase() === params.employeeNo!.toLowerCase());
  if (params.email) items = items.filter((x) => x.email.toLowerCase() === params.email!.toLowerCase());
  if (params.from) {
    const f = new Date(params.from);
    items = items.filter((x) => new Date(x.date) >= f);
  }
  if (params.to) {
    const t = new Date(params.to);
    items = items.filter((x) => new Date(x.date) <= t);
  }
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return items;
}

// Weekly off config: columns [email, monOff, tueOff, wedOff, thuOff, friOff, satOff, sunOff, effectiveFrom]
export async function setWeeklyOffConfig(id: string, days: { mon?: boolean; tue?: boolean; wed?: boolean; thu?: boolean; fri?: boolean; sat?: boolean; sun?: boolean }, effectiveFrom?: string) {
  const tbl = graphTables.weeklyOff();
  await addRowToTableByObject(tbl, {
    // support either column depending on your table header
    employeeNo: id,
    email: id,
    username: id,
    monOff: days.mon ? "TRUE" : "FALSE",
    tueOff: days.tue ? "TRUE" : "FALSE",
    wedOff: days.wed ? "TRUE" : "FALSE",
    thuOff: days.thu ? "TRUE" : "FALSE",
    friOff: days.fri ? "TRUE" : "FALSE",
    satOff: days.sat ? "TRUE" : "FALSE",
    sunOff: days.sun ? "TRUE" : "FALSE",
    effectiveFrom: effectiveFrom || new Date().toISOString().substring(0, 10),
  });
}

export async function getWeeklyOffConfig(idValue: string) {
  const tbl = graphTables.weeklyOff();
  const [headers, rows] = await Promise.all([getTableHeaders(tbl), getTableValues(tbl)]);
  const idx = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const idKey = idx("employeeNo") >= 0 ? "employeeNo" : (idx("username") >= 0 ? "username" : (idx("email") >= 0 ? "email" : null));
  const id = { 
    key: idKey,
    keyIdx: idKey ? idx(idKey) : -1,
    mon: idx("monOff"), tue: idx("tueOff"), wed: idx("wedOff"), thu: idx("thuOff"), fri: idx("friOff"), sat: idx("satOff"), sun: idx("sunOff"), eff: idx("effectiveFrom") 
  } as const;
  const filtered = id.keyIdx >= 0 ? rows.filter((r) => String(r[id.keyIdx] || "").toLowerCase() === idValue.toLowerCase()) : [];
  if (filtered.length === 0) return null;
  const last = filtered[filtered.length - 1];
  const b = (v: any) => String(v || "").toLowerCase() === "true";
  return {
    id: idValue,
    mon: b(last[id.mon]), tue: b(last[id.tue]), wed: b(last[id.wed]), thu: b(last[id.thu]), fri: b(last[id.fri]), sat: b(last[id.sat]), sun: b(last[id.sun]),
    effectiveFrom: String(last[id.eff] || ""),
  };
}

// Leaves table reader: expected columns
// [dtISO, leaveType, reason, email, name, employeeNo, supervisorEmail, province, channel, district]
export async function listLeaves(params: { from?: string; to?: string; email?: string; employeeNo?: string }) {
  const tbl = graphTables.leave();
  const [headers, rows] = await Promise.all([getTableHeaders(tbl), getTableValues(tbl)]);
  const idx = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const id = {
    dt: idx("dtISO"),
    type: idx("leaveType"),
    reason: idx("reason"),
    email: ((): number => { const u = idx("username"); return u >= 0 ? u : idx("email"); })(),
    name: idx("name"),
    employeeNo: idx("employeeNo"),
    province: idx("province"),
    channel: idx("channel"),
    district: idx("district"),
  };
  let items = rows.map((r) => ({
    date: id.dt >= 0 ? String(r[id.dt] || "") : "",
    leaveType: id.type >= 0 ? String(r[id.type] || "") : "",
    reason: id.reason >= 0 ? String(r[id.reason] || "") : "",
    email: id.email >= 0 ? String(r[id.email] || "") : "",
    name: id.name >= 0 ? String(r[id.name] || "") : "",
    employeeNo: id.employeeNo >= 0 ? String(r[id.employeeNo] || "") : "",
    province: id.province >= 0 ? String(r[id.province] || "") : "",
    channel: id.channel >= 0 ? String(r[id.channel] || "") : "",
    district: id.district >= 0 ? String(r[id.district] || "") : "",
  }));

  // Subtract soft-deleted entries if the optional deletes table exists and is readable.
  try {
    const delTbl = graphTables.leaveDeletes();
    const [dh, drows] = await Promise.all([getTableHeaders(delTbl), getTableValues(delTbl)]);
    const didx = (name: string) => dh.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    const dcol = {
      dt: didx("dtISO"),
      email: ((): number => { const u = didx("username"); return u >= 0 ? u : didx("email"); })(),
      employeeNo: didx("employeeNo"),
    } as const;
    if (drows.length > 0) {
      const deleted = new Set<string>();
      for (const r of drows) {
        const dt = dcol.dt >= 0 ? String(r[dcol.dt] || "") : "";
        const emp = dcol.employeeNo >= 0 ? String(r[dcol.employeeNo] || "") : "";
        const mail = dcol.email >= 0 ? String(r[dcol.email] || "") : "";
        if (!dt) continue;
        if (emp) deleted.add(`emp#${emp.toLowerCase()}|${dt}`);
        if (mail) deleted.add(`usr#${mail.toLowerCase()}|${dt}`);
      }
      items = items.filter((x) => {
        const dt = x.date || "";
        const emp = (x.employeeNo || "").toLowerCase();
        const mail = (x.email || "").toLowerCase();
        if (!dt) return true;
        if (emp && deleted.has(`emp#${emp}|${dt}`)) return false;
        if (mail && deleted.has(`usr#${mail}|${dt}`)) return false;
        return true;
      });
    }
  } catch {}
  if (params.employeeNo) items = items.filter((x) => (x.employeeNo || "").toLowerCase() === params.employeeNo!.toLowerCase());
  if (params.email) items = items.filter((x) => (x.email || "").toLowerCase() === params.email!.toLowerCase());
  if (params.from) {
    const f = new Date(params.from);
    items = items.filter((x) => new Date(x.date) >= f);
  }
  if (params.to) {
    const t = new Date(params.to);
    items = items.filter((x) => new Date(x.date) <= t);
  }
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return items;
}

// Record a soft-delete for a specific leave entry. Matches by (dtISO + employeeNo/username/email).
export async function addLeaveDelete(row: { dtISO: string; employeeNo?: string; email?: string; username?: string; by?: string }) {
  const tbl = graphTables.leaveDeletes();
  await addRowToTableByObject(tbl, {
    dtISO: row.dtISO,
    // write all identity variants to support whichever header the table uses
    employeeNo: row.employeeNo ?? "",
    email: row.email ?? row.username ?? "",
    username: row.username ?? row.email ?? "",
    deletedAt: new Date().toISOString(),
    deletedBy: row.by ?? "",
  });
}

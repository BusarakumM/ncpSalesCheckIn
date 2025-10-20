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
  detail?: string;
  status: "completed" | "incomplete" | "ongoing";
  name?: string;
  email?: string;
  imageIn?: string;
  imageOut?: string;
  district?: string;
  checkinGps?: string;
  checkoutGps?: string;
  checkinLat?: number;
  checkinLon?: number;
  checkoutLat?: number;
  checkoutLon?: number;
  distanceKm?: number;
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

export async function listActivities(params: { from?: string; to?: string; name?: string; email?: string; district?: string }): Promise<ActivityRow[]> {
  const tCheckin = graphTables.checkin();
  const tCheckout = graphTables.checkout();
  const [ciHeaders, ciRows, coHeaders, coRows] = await Promise.all([
    getTableHeaders(tCheckin),
    getTableValues(tCheckin),
    getTableHeaders(tCheckout),
    getTableValues(tCheckout),
  ]);

  type Key = string;
  const keyOf = (email: string, date: string, location: string) => `${email || ''}|${date}|${location || ''}`;

  function findIdx(headers: string[], name: string, fallback: number | null): number | null {
    const i = headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    return i >= 0 ? i : fallback;
  }
  const idx = {
    ci: {
      iso: findIdx(ciHeaders, "checkinISO", 0),
      location: findIdx(ciHeaders, "locationName", 1),
      gps: findIdx(ciHeaders, "gps", 2),
      lat: findIdx(ciHeaders, "checkinLat", null),
      lon: findIdx(ciHeaders, "checkinLon", null),
      title: findIdx(ciHeaders, "jobTitle", 3),
      detail: findIdx(ciHeaders, "jobDetail", 4),
      photo: findIdx(ciHeaders, "photoUrl", 5),
      email: findIdx(ciHeaders, "email", 6),
      name: findIdx(ciHeaders, "name", 7),
      district: findIdx(ciHeaders, "district", 12),
    },
    co: {
      iso: findIdx(coHeaders, "checkoutISO", 0),
      location: findIdx(coHeaders, "locationName", 1),
      gps: findIdx(coHeaders, "checkoutGps", 2),
      lat: findIdx(coHeaders, "checkoutLat", null),
      lon: findIdx(coHeaders, "checkoutLon", null),
      photo: findIdx(coHeaders, "checkoutPhotoUrl", 3),
      email: findIdx(coHeaders, "email", 4),
      name: findIdx(coHeaders, "name", 5),
      district: findIdx(coHeaders, "district", 10),
    },
  };

  const map = new Map<Key, ActivityRow>();

  function parseGps(s?: string): { lat: number; lon: number } | undefined {
    if (!s) return undefined;
    const m = String(s).trim().split(/\s*,\s*/);
    if (m.length !== 2) return undefined;
    const lat = Number(m[0]);
    const lon = Number(m[1]);
    if (!isFinite(lat) || !isFinite(lon)) return undefined;
    return { lat, lon };
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
    const key = keyOf(email, date, location);
    const gpsStr = idx.ci.gps != null ? String(r[idx.ci.gps] || "") : "";
    const parsed = idx.ci.lat != null && idx.ci.lon != null
      ? (isFinite(Number(r[idx.ci.lat])) && isFinite(Number(r[idx.ci.lon]))
          ? { lat: Number(r[idx.ci.lat]), lon: Number(r[idx.ci.lon]) }
          : undefined)
      : parseGps(gpsStr);
    map.set(key, {
      date,
      checkin: time,
      location,
      detail: String(idx.ci.detail != null ? r[idx.ci.detail] || "" : ""),
      status: "ongoing",
      name,
      email,
      imageIn: String(idx.ci.photo != null ? r[idx.ci.photo] || "" : ""),
      district: String(idx.ci.district != null ? r[idx.ci.district] || "" : ""),
      checkinGps: gpsStr,
      checkinLat: parsed?.lat,
      checkinLon: parsed?.lon,
    });
  }

  for (const r of coRows) {
    const iso = String(idx.co.iso != null ? r[idx.co.iso] || "" : "");
    const date = toDatePart(iso);
    const time = toTimePart(iso);
    const location = String(idx.co.location != null ? r[idx.co.location] || "" : "");
    const email = String(idx.co.email != null ? r[idx.co.email] || "" : "");
    const name = String(idx.co.name != null ? r[idx.co.name] || "" : "");
    const key = keyOf(email, date, location);
    const gpsStr = idx.co.gps != null ? String(r[idx.co.gps] || "") : "";
    const parsed = idx.co.lat != null && idx.co.lon != null
      ? (isFinite(Number(r[idx.co.lat])) && isFinite(Number(r[idx.co.lon]))
          ? { lat: Number(r[idx.co.lat]), lon: Number(r[idx.co.lon]) }
          : undefined)
      : parseGps(gpsStr);
    const row = map.get(key);
    if (row) {
      row.checkout = time;
      row.status = row.checkin ? "completed" : "incomplete";
      row.imageOut = String(idx.co.photo != null ? r[idx.co.photo] || "" : "");
      if (!row.name) row.name = name;
      if (!row.email) row.email = email;
      if (!row.district) row.district = String(idx.co.district != null ? r[idx.co.district] || "" : "");
      row.checkoutGps = gpsStr;
      row.checkoutLat = parsed?.lat;
      row.checkoutLon = parsed?.lon;
      if (row.checkinLat != null && row.checkinLon != null && row.checkoutLat != null && row.checkoutLon != null) {
        row.distanceKm = haversineKm({ lat: row.checkinLat, lon: row.checkinLon }, { lat: row.checkoutLat, lon: row.checkoutLon });
      }
    } else {
      map.set(key, {
        date,
        checkout: time,
        location,
        status: "incomplete",
        name,
        email,
        imageOut: String(idx.co.photo != null ? r[idx.co.photo] || "" : ""),
        district: String(idx.co.district != null ? r[idx.co.district] || "" : ""),
        checkoutGps: gpsStr,
        checkoutLat: parsed?.lat,
        checkoutLon: parsed?.lon,
      });
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

  // Order by date desc then name asc
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (a.name || '').localeCompare(b.name || '')));
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

// Look up a user from the Users table by email (case-insensitive)
export async function findUserByEmail(email: string): Promise<{
  email: string;
  role?: "SUPERVISOR" | "AGENT" | string;
  name?: string;
  employeeNo?: string;
  supervisorEmail?: string;
  province?: string;
  channel?: string;
  district?: string;
} | null> {
  const table = graphTables.users();
  const rows = await getTableValues(table);
  // Expected order: [email, role, name, employeeNo, supervisorEmail, province, channel, district]
  const idx = { email: 0, role: 1, name: 2, employeeNo: 3, supervisorEmail: 4, province: 5, channel: 6, district: 7 } as const;
  const target = email.trim().toLowerCase();
  for (const r of rows) {
    const em = String(r[idx.email] || "").trim().toLowerCase();
    if (!em) continue;
    if (em === target) {
      return {
        email: String(r[idx.email] || "").trim(),
        role: String(r[idx.role] || "").trim() as any,
        name: String(r[idx.name] || "").trim(),
        employeeNo: String(r[idx.employeeNo] || "").trim(),
        supervisorEmail: String(r[idx.supervisorEmail] || "").trim(),
        province: String(r[idx.province] || "").trim(),
        channel: String(r[idx.channel] || "").trim(),
        district: String(r[idx.district] || "").trim(),
      };
    }
  }
  return null;
}

// Company holidays: [dateISO, name, type, description]
export async function listHolidays(from?: string, to?: string): Promise<Array<{ date: string; name: string; type?: string; description?: string }>> {
  const tbl = graphTables.holidays();
  const [headers, rows] = await Promise.all([getTableHeaders(tbl), getTableValues(tbl)]);
  const idx = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const id = { date: idx("dateISO"), name: idx("name"), type: idx("type"), description: idx("description") };
  let items = rows.map((r) => ({
    date: String(id.date >= 0 ? r[id.date] : r[0] || ""),
    name: String(id.name >= 0 ? r[id.name] : r[1] || ""),
    type: id.type >= 0 ? String(r[id.type] || "") : "",
    description: id.description >= 0 ? String(r[id.description] || "") : "",
  }));
  if (from) {
    const f = new Date(from);
    items = items.filter((x) => new Date(x.date) >= f);
  }
  if (to) {
    const t = new Date(to);
    items = items.filter((x) => new Date(x.date) <= t);
  }
  items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return items;
}

// Day-offs table: [email, dateISO, leaveType, remark, by, createdAt]
export async function addDayOff(row: { employeeNo?: string; email?: string; dateISO: string; leaveType: string; remark?: string; by?: string }): Promise<void> {
  const tbl = graphTables.dayoffs();
  const payload = {
    employeeNo: row.employeeNo ?? "",
    email: row.email ?? "",
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
  const id = { employeeNo: idx("employeeNo"), email: idx("email"), date: idx("dateISO"), leaveType: idx("leaveType"), remark: idx("remark") };
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
  const idKey = idx("employeeNo") >= 0 ? "employeeNo" : (idx("email") >= 0 ? "email" : null);
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
    email: idx("email"),
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

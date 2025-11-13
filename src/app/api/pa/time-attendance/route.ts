import { NextResponse } from "next/server";
import { listActivities, listLeaves, getUsersLookup, normalizeLookupKey } from "@/lib/graph";

export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => ({}))) as any;
    const { from, to, name, email, username, district } = raw || {};

    const identity = email || username;
    const [activities, leaveItems, userLookup] = await Promise.all([
      listActivities({ from, to, name, email: identity, district }),
      listLeaves({ from, to }),
      getUsersLookup(),
    ]);

    const lookupInfo = (row: { employeeNo?: string; email?: string; name?: string }) => {
      const keys = [
        normalizeLookupKey(row.employeeNo),
        normalizeLookupKey(row.email),
        normalizeLookupKey(row.name),
      ].filter(Boolean) as string[];
      for (const key of keys) {
        const info = userLookup.get(key);
        if (info) return info;
      }
      return null;
    };

    type AggRow = {
      date: string;
      group?: string;
      district?: string;
      employeeNo?: string;
      name?: string;
      firstCheckin?: string;
      firstLocation?: string;
      firstImage?: string;
      firstGps?: string;
      firstAddress?: string;
      totalLocations: number;
      lastCheckout?: string;
      lastLocation?: string;
      lastCheckoutImage?: string;
      lastGps?: string;
      lastAddress?: string;
      leaveNote?: string;
      // internal helpers
      _firstMinutes: number;
      _lastMinutes: number;
      _locationSet: Set<string>;
    };

    const map = new Map<string, AggRow>();

    const keyFor = (date: string, row: { employeeNo?: string; email?: string; name?: string }) => {
      const identityKey =
        normalizeLookupKey(row.employeeNo) ||
        normalizeLookupKey(row.email) ||
        normalizeLookupKey(row.name) ||
        row.employeeNo ||
        row.email ||
        row.name ||
        "unknown";
      return `${date}|${identityKey}`;
    };

    const parseMinutes = (value?: string, fallback = Number.POSITIVE_INFINITY) => {
      if (!value) return fallback;
      const parts = value.includes(":") ? value.split(":") : value.split(".");
      const hh = parseInt(parts[0] || "0", 10);
      const mm = parseInt(parts[1] || "0", 10);
      if (!isFinite(hh) || !isFinite(mm)) return fallback;
      return hh * 60 + mm;
    };

    const ensureRow = (date: string, source: { employeeNo?: string; email?: string; name?: string; district?: string; group?: string }) => {
      const key = keyFor(date, source);
      if (!map.has(key)) {
        const info = lookupInfo(source);
        map.set(key, {
          date,
          group: source.group || info?.group || "",
          district: source.district || info?.district || "",
          employeeNo: source.employeeNo || info?.employeeNo || "",
          name: source.name || info?.name || "",
          firstCheckin: "",
          firstLocation: "",
          firstImage: "",
          firstGps: "",
          firstAddress: "",
          totalLocations: 0,
          lastCheckout: "",
          lastLocation: "",
          lastCheckoutImage: "",
          lastGps: "",
          lastAddress: "",
          leaveNote: "",
          _firstMinutes: Number.POSITIVE_INFINITY,
          _lastMinutes: -1,
          _locationSet: new Set<string>(),
        });
      } else {
        const row = map.get(key)!;
        if (!row.group && (source.group || lookupInfo(source)?.group)) row.group = source.group || lookupInfo(source)?.group || row.group;
        if (!row.district && (source.district || lookupInfo(source)?.district)) row.district = source.district || lookupInfo(source)?.district || row.district;
        if (!row.employeeNo && (source.employeeNo || lookupInfo(source)?.employeeNo)) row.employeeNo = source.employeeNo || lookupInfo(source)?.employeeNo || row.employeeNo;
        if (!row.name && (source.name || lookupInfo(source)?.name)) row.name = source.name || lookupInfo(source)?.name || row.name;
      }
      return map.get(key)!;
    };

    const recordLocationVisit = (row: AggRow, loc: string) => {
      if (!loc) return;
      row._locationSet.add(loc.trim().toLowerCase());
    };

    activities.forEach((a) => {
      const agg = ensureRow(a.date, { employeeNo: a.employeeNo, email: a.email, name: a.name, district: a.district, group: (a as any).group });
      const locationName = a.location || (a as any).checkinLocation || (a as any).checkoutLocation || "";
      if (locationName) recordLocationVisit(agg, locationName);
      const checkinMinutes = parseMinutes(a.checkin);
      if (a.checkin && checkinMinutes < agg._firstMinutes) {
        agg._firstMinutes = checkinMinutes;
        agg.firstCheckin = a.checkin;
        if (locationName) agg.firstLocation = locationName;
        if (a.imageIn) agg.firstImage = a.imageIn;
        if (a.checkinGps) agg.firstGps = a.checkinGps;
        if (a.checkinAddress) agg.firstAddress = a.checkinAddress;
      } else if (!agg.firstLocation && locationName) {
        agg.firstLocation = locationName;
      }
      if (!agg.firstImage && a.imageIn) {
        agg.firstImage = a.imageIn;
      }
      if (!agg.firstGps && a.checkinGps) {
        agg.firstGps = a.checkinGps;
      }
      if (!agg.firstAddress && a.checkinAddress) {
        agg.firstAddress = a.checkinAddress;
      }
      const checkoutMinutes = parseMinutes(a.checkout, -1);
      if (a.checkout && checkoutMinutes >= agg._lastMinutes) {
        const shouldUpdate = checkoutMinutes > agg._lastMinutes || !agg.lastCheckout;
        if (shouldUpdate) {
          agg._lastMinutes = checkoutMinutes;
          agg.lastCheckout = a.checkout;
          if (locationName) agg.lastLocation = locationName;
          if (a.imageOut) agg.lastCheckoutImage = a.imageOut;
          if (a.checkoutGps) agg.lastGps = a.checkoutGps;
          if (a.checkoutAddress) agg.lastAddress = a.checkoutAddress;
        } else {
          if (locationName && !agg.lastLocation) agg.lastLocation = locationName;
          if (a.imageOut && !agg.lastCheckoutImage) agg.lastCheckoutImage = a.imageOut;
          if (a.checkoutGps && !agg.lastGps) agg.lastGps = a.checkoutGps;
          if (a.checkoutAddress && !agg.lastAddress) agg.lastAddress = a.checkoutAddress;
        }
      } else {
        if (!agg.lastCheckoutImage && a.imageOut) {
          agg.lastCheckoutImage = a.imageOut;
        }
        if (!agg.lastLocation && locationName) {
          agg.lastLocation = locationName;
        }
        if (!agg.lastGps && a.checkoutGps) {
          agg.lastGps = a.checkoutGps;
        }
        if (!agg.lastAddress && a.checkoutAddress) {
          agg.lastAddress = a.checkoutAddress;
        }
      }
    });

    leaveItems.forEach((leave) => {
      const leaveDate = (() => {
        const d = new Date(leave.date || "");
        if (isNaN(d.getTime())) return "";
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      })();
      if (!leaveDate) return;
      const agg = ensureRow(leaveDate, { employeeNo: leave.employeeNo, email: leave.email, name: leave.name, district: leave.district, group: leave.group });
      const note = String(leave.leaveType || "").trim() || "Leave";
      agg.leaveNote = agg.leaveNote ? `${agg.leaveNote}; ${note}` : note;
    });

    const result = Array.from(map.values()).map((row) => ({
      date: row.date,
      group: row.group || "",
      district: row.district || "",
      employeeNo: row.employeeNo || "",
      name: row.name || "",
      firstCheckin: row.firstCheckin || "",
      firstLocation: row.firstLocation || "",
      firstImage: row.firstImage || "",
      firstGps: row.firstGps || "",
      firstAddress: row.firstAddress || "",
      totalLocations: row._locationSet.size || row.totalLocations,
      lastCheckout: row.lastCheckout || "",
      lastLocation: row.lastLocation || "",
      lastCheckoutImage: row.lastCheckoutImage || "",
      lastGps: row.lastGps || "",
      lastAddress: row.lastAddress || "",
      leaveNote: row.leaveNote || "",
    }));

    let filtered = result;
    if (name) {
      const n = String(name).toLowerCase();
      filtered = filtered.filter((r) => (r.name || "").toLowerCase().includes(n));
    }
    if (district) {
      const d = String(district).toLowerCase();
      filtered = filtered.filter((r) => (r.district || "").toLowerCase().includes(d));
    }

    filtered.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      const na = (a.name || "").toLowerCase();
      const nb = (b.name || "").toLowerCase();
      if (na !== nb) return na.localeCompare(nb);
      return (a.employeeNo || "").localeCompare(b.employeeNo || "");
    });

    return NextResponse.json({ ok: true, rows: filtered });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed to load time-attendance" }, { status: 500 });
  }
}

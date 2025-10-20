export type UserRole = "SUPERVISOR" | "AGENT";

export type BackendResolveRequest = {
  email?: string | null;
  user?: string | null;
  password?: string | null;
};

type BackendResolveResponse = {
  role?: UserRole;
  name?: string;
  email?: string;
  employeeNo?: string;
  supervisorEmail?: string;
  province?: string;
  channel?: string;
  stores?: Array<{ id: string; name: string; province?: string; channel?: string }>;
};

export type ResolvedUser = {
  role: UserRole;
  name: string;
  email: string;
  metadata: {
    employeeNo?: string;
    supervisorEmail?: string;
    province?: string;
    channel?: string;
    district?: string;
    stores?: Array<{ id: string; name: string; province?: string; channel?: string }>;
  };
  resolution: {
    source: "backend" | "fallback";
    confidence: "high" | "medium" | "low";
    reason: string;
  };
};

const SUPERVISOR_KEYWORDS = ["supervisor", "manager", "head"].map((kw) => kw.toLowerCase());

function normalize(value?: string | null) {
  return value?.trim().toLowerCase() || undefined;
}

function resolveFallback(payload: BackendResolveRequest, reason: string): ResolvedUser {
  const email = normalize(payload.email);
  const user = normalize(payload.user);

  const defaultName = payload.user?.trim() || payload.email?.trim() || "User";

  if (email && SUPERVISOR_KEYWORDS.some((kw) => email.includes(kw))) {
    return {
      role: "SUPERVISOR",
      name: defaultName,
      email: email,
      metadata: {},
      resolution: { source: "fallback", confidence: "medium", reason: `${reason}; matched supervisor keyword in email` },
    };
  }

  if (user && SUPERVISOR_KEYWORDS.some((kw) => user.includes(kw))) {
    return {
      role: "SUPERVISOR",
      name: defaultName,
      email: email ?? user,
      metadata: {},
      resolution: { source: "fallback", confidence: "low", reason: `${reason}; matched supervisor keyword in username` },
    };
  }

  return {
    role: "AGENT",
    name: defaultName,
    email: email ?? user ?? "",
    metadata: {},
    resolution: { source: "fallback", confidence: "low", reason },
  };
}

import { findUserByEmail } from "@/lib/graph";

async function resolveFromGraph(payload: BackendResolveRequest): Promise<ResolvedUser | null> {
  const tbl = process.env.GRAPH_TBL_USERS;
  const email = normalize(payload.email) || normalize(payload.user);
  if (!tbl || !email) return null;
  try {
    const row = await findUserByEmail(email);
    if (!row) return null;
    const roleRaw = (row.role || "").toString().trim().toUpperCase();
    const role = roleRaw === "SUPERVISOR" ? "SUPERVISOR" : roleRaw === "AGENT" ? "AGENT" : "AGENT";
    return {
      role,
      name: row.name || payload.user?.trim() || payload.email?.trim() || "User",
      email: row.email || payload.email?.trim() || payload.user?.trim() || "",
      metadata: {
        employeeNo: row.employeeNo,
        supervisorEmail: row.supervisorEmail,
        province: row.province,
        channel: row.channel,
        district: (row as any).district,
      },
      resolution: {
        source: "backend",
        confidence: "high",
        reason: "Resolved by Graph Users table",
      },
    };
  } catch (e) {
    console.error("resolveFromGraph error", e);
    return null;
  }
}

export async function resolveUserRole(payload: BackendResolveRequest): Promise<ResolvedUser> {
  // 1) Try Graph Users table if configured
  const g = await resolveFromGraph(payload);
  if (g) return g;

  // 2) Try PA resolve backend if configured (legacy)
  const endpoint = process.env.PA_RESOLVE_USER_URL;
  if (endpoint) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.PA_RESOLVE_USER_KEY ? { "x-pa-key": process.env.PA_RESOLVE_USER_KEY } : {}),
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Backend responded with ${res.status}: ${text}`);
      }

      const data = (await res.json().catch(() => ({}))) as BackendResolveResponse;
      if (data.role !== "SUPERVISOR" && data.role !== "AGENT") {
        throw new Error("Backend did not return a valid role");
      }

      return {
        role: data.role,
        name: data.name?.trim() || payload.user?.trim() || payload.email?.trim() || "User",
        email: data.email?.trim() || payload.email?.trim() || payload.user?.trim() || "",
        metadata: {
          employeeNo: data.employeeNo,
          supervisorEmail: data.supervisorEmail,
          province: data.province,
          channel: data.channel,
          stores: data.stores,
        },
        resolution: {
          source: "backend",
          confidence: "high",
          reason: "Resolved by Power Automate backend",
        },
      };
    } catch (error) {
      console.error("resolveUserRole PA fallback", error);
    }
  }

  // 3) Fallback heuristic
  return resolveFallback(payload, endpoint ? "PA backend failed" : "No backend configured");
}

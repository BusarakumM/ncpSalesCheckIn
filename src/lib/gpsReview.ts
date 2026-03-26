export type ActivityStatus = "completed" | "incomplete" | "ongoing" | "pending_review";

export type GpsReviewMeta = {
  status: "pending_review";
  kind: "checkin" | "checkout";
  note: string;
  accuracy?: number | null;
  retries?: number;
  reason?: "weak_gps" | "weak_gps_out_of_area";
};

export const GPS_GOOD_ACCURACY_METERS = 50;
export const GPS_RELIABLE_ACCURACY_METERS = 150;
export const MIN_GPS_RETRY_ATTEMPTS_FOR_REVIEW = 2;
const GPS_REVIEW_META_PREFIX = "__gps_review__:";

export function isReliableGpsAccuracy(accuracy: number | null | undefined, maxMeters = GPS_RELIABLE_ACCURACY_METERS) {
  return typeof accuracy === "number" && isFinite(accuracy) && accuracy <= maxMeters;
}

export function isWeakGpsAccuracy(accuracy: number | null | undefined) {
  return !isReliableGpsAccuracy(accuracy);
}

export function encodeGpsReviewMeta(meta: GpsReviewMeta) {
  return `${GPS_REVIEW_META_PREFIX}${JSON.stringify(meta)}`;
}

export function parseGpsReviewMeta(value: unknown): GpsReviewMeta | null {
  if (typeof value !== "string" || !value.startsWith(GPS_REVIEW_META_PREFIX)) return null;
  try {
    const parsed = JSON.parse(value.slice(GPS_REVIEW_META_PREFIX.length)) as GpsReviewMeta;
    if (parsed?.status !== "pending_review" || !parsed.kind) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function evaluatePendingReviewOption(input: {
  gps?: string;
  accuracy?: number | null;
  retries?: number;
  note?: string;
  hasPhoto?: boolean;
  distanceKm?: number | null;
  maxDistanceKm?: number | null;
}) {
  const gps = (input.gps || "").trim();
  const retries = input.retries ?? 0;
  const note = (input.note || "").trim();
  const weakGps = isWeakGpsAccuracy(input.accuracy);
  const farFromCheckin =
    typeof input.distanceKm === "number" &&
    isFinite(input.distanceKm) &&
    typeof input.maxDistanceKm === "number" &&
    isFinite(input.maxDistanceKm) &&
    input.distanceKm > input.maxDistanceKm;

  if (!gps) {
    return { allowed: false, shouldSaveDraftOnly: true, message: "ยังไม่มีพิกัด กรุณากดบันทึกไว้ก่อน" };
  }
  if (!input.hasPhoto) {
    return { allowed: false, message: "กรุณาถ่ายรูปก่อนส่งให้หัวหน้าตรวจ" };
  }
  if (retries < MIN_GPS_RETRY_ATTEMPTS_FOR_REVIEW) {
    return { allowed: false, message: "กรุณาลองจับพิกัดอีกครั้งก่อนส่งให้หัวหน้าตรวจ" };
  }
  if (!note) {
    return { allowed: false, message: "กรุณาระบุเหตุผลสั้นๆ" };
  }
  if (farFromCheckin && !weakGps) {
    return {
      allowed: false,
      shouldBlock: true,
      message: "พิกัดอยู่ไกลเกินไปและสัญญาณชัดเจน จึงส่งให้หัวหน้าตรวจไม่ได้",
    };
  }
  if (!weakGps && !farFromCheckin) {
    return { allowed: false, message: "พิกัดปกติแล้ว กรุณากดบันทึกตามปกติ" };
  }
  return {
    allowed: true,
    reason: farFromCheckin ? "weak_gps_out_of_area" : "weak_gps",
  } as const;
}

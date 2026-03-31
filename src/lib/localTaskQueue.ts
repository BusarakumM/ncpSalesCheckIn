import { isReliableAccuracy } from "@/lib/geolocation";
import { evaluatePendingReviewOption } from "@/lib/gpsReview";
import { submitCheckin, submitCheckout, uploadPhoto } from "@/lib/paClient";
import { deleteTaskDraft, draftToFile, listTaskDrafts, loadTaskDraft, type TaskDraft } from "@/lib/taskDrafts";

export type LocalTaskSummary = {
  key: string;
  resumeHref: string;
  stage: "checkin" | "checkout";
  mode: "draft" | "ready";
  locationName: string;
  updatedAt: number;
  timeLabel: string;
  statusLabel: string;
  note: string;
};

function maxDistanceKm(): number {
  const value = process.env.NEXT_PUBLIC_MAX_DISTANCE_KM || "0.5";
  const parsed = Number(value);
  return isFinite(parsed) && parsed > 0 ? parsed : 0.5;
}

function toLatLonPair(coord?: string): [number, number] | null {
  if (!coord) return null;
  const parts = coord.split(",");
  if (parts.length < 2) return null;
  const lat = Number(parts[0].trim());
  const lon = Number(parts[1].trim());
  if (!isFinite(lat) || !isFinite(lon)) return null;
  return [lat, lon];
}

function distanceKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const la1 = a[0] * Math.PI / 180;
  const la2 = b[0] * Math.PI / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(la1) * Math.cos(la2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function getCheckoutDistanceKm(draft: TaskDraft): number | null {
  const a = toLatLonPair(draft.gps);
  const b = toLatLonPair(draft.checkoutGps);
  if (!a || !b) return null;
  return distanceKm(a, b);
}

export function getDraftStage(draft: TaskDraft): "checkin" | "checkout" {
  if (draft.stage === "checkin" || draft.stage === "checkout") {
    return draft.stage;
  }
  return draft.checkoutTime || draft.checkoutGps || draft.checkoutPhoto ? "checkout" : "checkin";
}

export function getDraftResumeHref(key: string, draft: TaskDraft) {
  if (draft.resumeHref) return draft.resumeHref;
  if (draft.taskId) return `/checkin/${draft.taskId}`;
  if (key.startsWith("checkin:task:")) return `/checkin/${key.slice("checkin:task:".length)}`;
  return `/checkin/new?draft=${encodeURIComponent(key)}`;
}

function getDraftTaskId(key: string, draft: TaskDraft) {
  if (draft.taskId) return draft.taskId;
  if (key.startsWith("checkin:task:")) return key.slice("checkin:task:".length);
  return undefined;
}

function getTimeLabel(draft: TaskDraft, stage: "checkin" | "checkout") {
  const value = stage === "checkout" ? draft.checkoutTime : draft.checkinTime;
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return value;
  }
}

export function canSyncTaskDraft(draft: TaskDraft) {
  const stage = getDraftStage(draft);
  const locationName = String(draft.locationName || "").trim();

  if (stage === "checkin") {
    if (!locationName || !draft.photo) return false;
    if (draft.gps && isReliableAccuracy(draft.gpsAccuracy)) return true;
    return evaluatePendingReviewOption({
      gps: draft.gps,
      accuracy: draft.gpsAccuracy,
      retries: draft.gpsAttempts,
      note: draft.checkinReviewNote,
      hasPhoto: !!draft.photo,
    }).allowed;
  }

  if (!locationName || !draft.checkoutPhoto) return false;
  if (draft.checkoutGps && isReliableAccuracy(draft.checkoutGpsAccuracy)) {
    const distance = getCheckoutDistanceKm(draft);
    if (typeof distance === "number" && isFinite(distance) && distance > maxDistanceKm()) {
      return false;
    }
    return true;
  }
  return evaluatePendingReviewOption({
    gps: draft.checkoutGps,
    accuracy: draft.checkoutGpsAccuracy,
    retries: draft.checkoutGpsAttempts,
    note: draft.checkoutReviewNote,
    hasPhoto: !!draft.checkoutPhoto,
    distanceKm: getCheckoutDistanceKm(draft),
    maxDistanceKm: maxDistanceKm(),
  }).allowed;
}

function buildDraftNote(draft: TaskDraft, stage: "checkin" | "checkout", mode: "draft" | "ready") {
  if (mode === "ready") {
    return "พร้อมส่งเมื่อมีสัญญาณ";
  }
  if (stage === "checkout" && draft.checkoutGps && isReliableAccuracy(draft.checkoutGpsAccuracy)) {
    const distance = getCheckoutDistanceKm(draft);
    if (typeof distance === "number" && isFinite(distance) && distance > maxDistanceKm()) {
      return "จุดออกงานไกลเกินไป";
    }
  }
  const gps = stage === "checkout" ? draft.checkoutGps : draft.gps;
  const photo = stage === "checkout" ? draft.checkoutPhoto : draft.photo;
  if (!gps) return "ยังไม่มีพิกัด";
  if (!photo) return "ยังไม่มีรูป";
  return "กลับมาทำต่อภายหลังได้";
}

export function toLocalTaskSummary(draft: TaskDraft): LocalTaskSummary {
  const stage = getDraftStage(draft);
  const mode = canSyncTaskDraft(draft) ? "ready" : "draft";
  return {
    key: draft.key,
    resumeHref: getDraftResumeHref(draft.key, draft),
    stage,
    mode,
    locationName: draft.locationName?.trim() || "งานที่บันทึกไว้",
    updatedAt: draft.updatedAt || 0,
    timeLabel: getTimeLabel(draft, stage),
    statusLabel: mode === "ready" ? "รอส่งเข้าระบบ" : "บันทึกไว้ในเครื่อง",
    note: buildDraftNote(draft, stage, mode),
  };
}

export async function listLocalTaskSummaries(): Promise<LocalTaskSummary[]> {
  const drafts = await listTaskDrafts();
  return drafts
    .filter((draft) => draft?.key)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .map(toLocalTaskSummary);
}

export async function syncTaskDraft(key: string): Promise<void> {
  const draft = await loadTaskDraft(key);
  if (!draft) throw new Error("ไม่พบข้อมูลงานที่บันทึกไว้");

  const stage = getDraftStage(draft);
  if (!canSyncTaskDraft(draft)) {
    throw new Error("ข้อมูลยังไม่ครบ กรุณาเปิดรายการแล้วทำต่อ");
  }

  if (stage === "checkin") {
    const photo = draftToFile(draft.photo);
    if (!photo) throw new Error("ยังไม่มีรูปเข้างาน");
    const photoUrl = await uploadPhoto(photo);
    const isReliableGps = !!draft.gps && isReliableAccuracy(draft.gpsAccuracy);
    const taskId = getDraftTaskId(key, draft);

    if (isReliableGps) {
      await submitCheckin({
        id: taskId,
        checkin: draft.checkinTime || "",
        locationName: draft.locationName || "",
        gps: draft.gps || "",
        checkinAddress: draft.checkinAddress || "",
        jobDetail: draft.jobDetail || "",
        photoUrl,
      });
    } else {
      const decision = evaluatePendingReviewOption({
        gps: draft.gps,
        accuracy: draft.gpsAccuracy,
        retries: draft.gpsAttempts,
        note: draft.checkinReviewNote,
        hasPhoto: !!draft.photo,
      });
      if (!decision.allowed) {
        throw new Error(decision.message || "ยังส่งให้หัวหน้าตรวจไม่ได้");
      }
      await submitCheckin({
        id: taskId,
        checkin: draft.checkinTime || "",
        locationName: draft.locationName || "",
        gps: draft.gps || "",
        checkinAddress: draft.checkinAddress || "",
        jobDetail: draft.jobDetail || "",
        photoUrl,
        reviewStatus: "pending_review",
        signalIssueReason: String(draft.checkinReviewNote || "").trim(),
        gpsAccuracy: draft.gpsAccuracy,
        gpsRetryCount: draft.gpsAttempts,
      });
    }
  } else {
    const photo = draftToFile(draft.checkoutPhoto);
    if (!photo) throw new Error("ยังไม่มีรูปออกงาน");
    const photoUrl = await uploadPhoto(photo);
    const isReliableGps = !!draft.checkoutGps && isReliableAccuracy(draft.checkoutGpsAccuracy);
    const taskId = getDraftTaskId(key, draft);

    if (isReliableGps) {
      const distance = getCheckoutDistanceKm(draft);
      if (typeof distance === "number" && isFinite(distance) && distance > maxDistanceKm()) {
        throw new Error("จุดออกงานห่างจากจุดเข้างานมากเกินไป");
      }
      await submitCheckout({
        id: taskId,
        checkout: draft.checkoutTime || "",
        checkoutGps: draft.checkoutGps || "",
        checkoutAddress: draft.checkoutAddress || "",
        checkoutPhotoUrl: photoUrl,
        locationName: draft.locationName || "",
        checkoutRemark: draft.checkoutRemark || "",
        problemDetail: draft.problemDetail || "",
        problem: draft.problemDetail || "",
        jobRemark: draft.jobRemark || "",
        remark: draft.jobRemark || "",
      });
    } else {
      const decision = evaluatePendingReviewOption({
        gps: draft.checkoutGps,
        accuracy: draft.checkoutGpsAccuracy,
        retries: draft.checkoutGpsAttempts,
        note: draft.checkoutReviewNote,
        hasPhoto: !!draft.checkoutPhoto,
        distanceKm: getCheckoutDistanceKm(draft),
        maxDistanceKm: maxDistanceKm(),
      });
      if (!decision.allowed) {
        throw new Error(decision.message || "ยังส่งให้หัวหน้าตรวจไม่ได้");
      }
      await submitCheckout({
        id: taskId,
        checkout: draft.checkoutTime || "",
        checkoutGps: draft.checkoutGps || "",
        checkoutAddress: draft.checkoutAddress || "",
        checkoutPhotoUrl: photoUrl,
        locationName: draft.locationName || "",
        checkoutRemark: draft.checkoutRemark || "",
        problemDetail: draft.problemDetail || "",
        problem: draft.problemDetail || "",
        jobRemark: draft.jobRemark || "",
        remark: draft.jobRemark || "",
        reviewStatus: "pending_review",
        reviewReason: decision.reason,
        signalIssueReason: String(draft.checkoutReviewNote || "").trim(),
        gpsAccuracy: draft.checkoutGpsAccuracy,
        gpsRetryCount: draft.checkoutGpsAttempts,
      });
    }
  }

  await deleteTaskDraft(key);
}

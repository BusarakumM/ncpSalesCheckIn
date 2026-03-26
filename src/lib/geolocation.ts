import { GPS_GOOD_ACCURACY_METERS, GPS_RELIABLE_ACCURACY_METERS, isReliableGpsAccuracy } from "@/lib/gpsReview";

export type CapturedLocation = {
  lat: number;
  lon: number;
  coord: string;
  accuracy: number;
  capturedAt: number;
};

type CaptureBestLocationOptions = {
  timeoutMs?: number;
  targetAccuracyMeters?: number;
};

const DEFAULT_TIMEOUT_MS = 9000;
const DEFAULT_TARGET_ACCURACY_METERS = GPS_GOOD_ACCURACY_METERS;

function toFriendlyMessage(error?: { code?: number } | null) {
  switch (error?.code) {
    case 1:
      return "กรุณาเปิดตำแหน่งของโทรศัพท์ แล้วกดลองใหม่";
    case 2:
      return "ยังหาตำแหน่งไม่เจอ กรุณาไปที่โล่งหรือใกล้หน้าต่าง แล้วกดลองใหม่";
    case 3:
      return "หาตำแหน่งช้าเกินไป กรุณาลองใหม่อีกครั้ง";
    default:
      return "ยังหาตำแหน่งไม่เจอ กรุณากดลองใหม่";
  }
}

function toCapturedLocation(position: GeolocationPosition): CapturedLocation {
  const lat = Number(position.coords.latitude.toFixed(6));
  const lon = Number(position.coords.longitude.toFixed(6));
  return {
    lat,
    lon,
    coord: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
    accuracy: position.coords.accuracy,
    capturedAt: Date.now(),
  };
}

export function isReliableAccuracy(accuracy: number | null | undefined, maxMeters = GPS_RELIABLE_ACCURACY_METERS) {
  return isReliableGpsAccuracy(accuracy, maxMeters);
}

export function getAccuracyStatusText(accuracy: number | null | undefined) {
  if (typeof accuracy !== "number" || !isFinite(accuracy)) return "";
  if (accuracy <= GPS_GOOD_ACCURACY_METERS) return "ได้ตำแหน่งแล้ว";
  if (accuracy <= GPS_RELIABLE_ACCURACY_METERS) return "ได้ตำแหน่งแล้ว แต่สัญญาณยังไม่นิ่ง";
  return "ตำแหน่งยังไม่ชัด";
}

export function getAccuracyHelpText(accuracy: number | null | undefined) {
  if (typeof accuracy !== "number" || !isFinite(accuracy)) {
    return "ถ้ารอนาน ให้ขยับไปที่โล่งหรือใกล้หน้าต่าง แล้วกดใหม่";
  }
  const rounded = Math.max(1, Math.round(accuracy));
  if (accuracy <= GPS_GOOD_ACCURACY_METERS) return `ตำแหน่งอาจคลาดเคลื่อนประมาณ ${rounded} เมตร`;
  if (accuracy <= GPS_RELIABLE_ACCURACY_METERS) {
    return `ตำแหน่งอาจคลาดเคลื่อนประมาณ ${rounded} เมตร ถ้าทำได้ลองขยับไปที่โล่ง`;
  }
  return `ตำแหน่งยังคลาดเคลื่อนมากประมาณ ${rounded} เมตร กรุณากดจับพิกัดอีกครั้ง`;
}

export async function captureBestLocation(options: CaptureBestLocationOptions = {}): Promise<CapturedLocation> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    throw new Error("โทรศัพท์เครื่องนี้ยังหาตำแหน่งไม่ได้");
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const targetAccuracyMeters = options.targetAccuracyMeters ?? DEFAULT_TARGET_ACCURACY_METERS;

  return await new Promise<CapturedLocation>((resolve, reject) => {
    let bestPosition: GeolocationPosition | null = null;
    let lastError: GeolocationPositionError | null = null;
    let settled = false;
    let watchId = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      navigator.geolocation.clearWatch(watchId);
      fn();
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!bestPosition || position.coords.accuracy < bestPosition.coords.accuracy) {
          bestPosition = position;
        }
        if (position.coords.accuracy <= targetAccuracyMeters) {
          finish(() => resolve(toCapturedLocation(position)));
        }
      },
      (error) => {
        lastError = error;
        if (error.code === 1) {
          finish(() => reject(new Error(toFriendlyMessage(error))));
        }
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );

    timer = setTimeout(() => {
      if (bestPosition) {
        finish(() => resolve(toCapturedLocation(bestPosition)));
        return;
      }
      finish(() => reject(new Error(toFriendlyMessage(lastError))));
    }, timeoutMs);
  });
}

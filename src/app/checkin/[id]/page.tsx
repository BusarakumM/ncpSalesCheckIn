"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import LoadingButton from "@/components/LoadingButton";
import {
  captureBestLocation,
  getAccuracyHelpText,
  getAccuracyStatusText,
  isReliableAccuracy,
  type CapturedLocation,
} from "@/lib/geolocation";
import { evaluatePendingReviewOption } from "@/lib/gpsReview";
import { submitCheckin, submitCheckout, uploadPhoto } from "@/lib/paClient";
import { deleteTaskDraft, draftToFile, fileToDraft, loadTaskDraft, saveTaskDraft } from "@/lib/taskDrafts";

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const draftKey = `checkin:task:${id}`;
  const [checkinTime, setCheckinTime] = useState("");
  const [checkoutTime, setCheckoutTime] = useState("");
  const [displayTitle, setDisplayTitle] = useState<string>("Task");
  const [locationName, setLocationName] = useState("");
  const [gps, setGps] = useState<string>("");
  const [checkinAddress, setCheckinAddress] = useState<string>("");
  const [checkoutGps, setCheckoutGps] = useState<string>("");
  const [checkoutAddress, setCheckoutAddress] = useState<string>("");
  const [jobDetail, setJobDetail] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [checkoutPhotoUrl, setCheckoutPhotoUrl] = useState<string | null>(null);
  const [checkoutPhotoFile, setCheckoutPhotoFile] = useState<File | null>(null);
  const [checkoutRemark, setCheckoutRemark] = useState("");
  const [problemDetail, setProblemDetail] = useState("");
  const [jobRemark, setJobRemark] = useState("");
  const [checkinPhotoTakenAt, setCheckinPhotoTakenAt] = useState<number | null>(null);
  const [checkoutPhotoTakenAt, setCheckoutPhotoTakenAt] = useState<number | null>(null);
  const [checkinCaptureAt, setCheckinCaptureAt] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const checkoutFileRef = useRef<HTMLInputElement | null>(null);
  const [hasExistingCheckin, setHasExistingCheckin] = useState(false);
  const [hasExistingCheckout, setHasExistingCheckout] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Click locks to prevent rapid double submissions
  const checkinLockRef = useRef(false);
  const checkoutLockRef = useRef(false);
  const [showDetails, setShowDetails] = useState(false);
  const [checkoutOutOfArea, setCheckoutOutOfArea] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("");
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [checkinGpsAttempts, setCheckinGpsAttempts] = useState(0);
  const [checkinReviewNote, setCheckinReviewNote] = useState("");
  const [checkinMapFailed, setCheckinMapFailed] = useState(false);
  const [checkoutGpsStatus, setCheckoutGpsStatus] = useState("");
  const [checkoutGpsAccuracy, setCheckoutGpsAccuracy] = useState<number | null>(null);
  const [checkoutGpsAttempts, setCheckoutGpsAttempts] = useState(0);
  const [checkoutReviewNote, setCheckoutReviewNote] = useState("");
  const [checkoutMapFailed, setCheckoutMapFailed] = useState(false);
  const [draftNotice, setDraftNotice] = useState("");
  // Auto-expire check-in location/GPS if not submitted within 10 minutes (before check-in exists)
  const checkinTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  function clearCheckinTimeout() {
    if (checkinTimeoutRef.current) {
      clearTimeout(checkinTimeoutRef.current);
      checkinTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    // Only apply the timeout if check-in has not been submitted yet
    clearCheckinTimeout();
    if (!hasExistingCheckin && gps.trim()) {
      checkinTimeoutRef.current = setTimeout(() => {
        setGps("");
        setLocationName("");
        setCheckinAddress("");
        setGpsAccuracy(null);
        setGpsStatus("หมดเวลายืนยันตำแหน่ง กรุณาจับพิกัดใหม่");
        alert("หมดเวลายืนยันตำแหน่ง กรุณาจับพิกัดใหม่");
      }, 5 * 60 * 1000);
    }
    return () => {
      clearCheckinTimeout();
    };
  }, [gps, hasExistingCheckin]);

  // Try to load existing task by stable key (email|date|location); otherwise default time to now
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let decoded = "";
        try {
          decoded = typeof atob === 'function'
            ? decodeURIComponent(escape(atob(decodeURIComponent(id))))
            : "";
        } catch {}
        const parts = decoded.split("|");
        const email = parts[0] || "";
        const date = parts[1] || "";
        const location = parts[2] || "";
        const timeHint = parts[3] || ""; // HH:mm optional
        if (date || location) {
          const dDisp = date ? new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
          setDisplayTitle([location || "Task", dDisp].filter(Boolean).join(" — "));
        }
        if (email && date) {
          const res = await fetch('/api/pa/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: date, to: date, email }) });
          const data = await res.json();
          if (res.ok && data?.ok && Array.isArray(data.rows)) {
            let row = (data.rows as any[]).find((r) => (r.location || "") === (location || "") && (!timeHint || (r.checkin || "") === timeHint));
            if (!row) {
              row = (data.rows as any[]).find((r) => (r.location || "") === (location || ""));
            }
            if (row && !cancelled) {
              // Preload name from existing row
              setLocationName(row.location || "");
              setGps(row.checkinGps || "");
              setCheckoutGps(row.checkoutGps || "");
              setGpsStatus(row.checkinGps ? "บันทึกตำแหน่งไว้แล้ว" : "");
              setCheckoutGpsStatus(row.checkoutGps ? "บันทึกตำแหน่งไว้แล้ว" : "");
              setJobDetail(row.detail || "");
              if (row.imageIn) setPhotoUrl(row.imageIn);
              if (row.imageOut) setCheckoutPhotoUrl(row.imageOut);
              const toLocalInput = (d: string, t?: string) => {
                if (!d || !t) return "";
                const [hh, mm] = String(t).split(":");
                const dt = new Date(`${d}T${hh.padStart(2,'0')}:${mm.padStart(2,'0')}:00`);
                const isoLocal = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0,16);
                return isoLocal;
              };
              setCheckinTime(toLocalInput(row.date, row.checkin));
              setCheckoutTime(toLocalInput(row.date, row.checkout));
              setHasExistingCheckin(!!row.checkin);
              setHasExistingCheckout(!!row.checkout);
              await applyDraftFromStorage();
              return;
            }
          }
        }
      } catch {}
      if (!cancelled) {
        const now = new Date();
        const isoLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,16);
        setCheckinTime(isoLocal);
        setHasExistingCheckin(false);
        setHasExistingCheckout(false);
        setDisplayTitle("New Task");
        await applyDraftFromStorage();
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (hasExistingCheckin) return;
    void captureGPS();
  }, [hasExistingCheckin]);

  useEffect(() => {
    if (hasExistingCheckin) return;
    const fallback = gps.trim();
    const desired = jobDetail.trim() || fallback;
    if (desired !== locationName) {
      setLocationName(desired);
    }
  }, [jobDetail, gps, hasExistingCheckin, locationName]);

  async function reverseGeocode(lat: number, lon: number): Promise<string> {
    try {
      const res = await fetch(`/api/maps/geocode?lat=${lat}&lon=${lon}`, { cache: "no-store" });
      if (!res.ok) return "";
      const data = await res.json();
      return data?.address || "";
    } catch {
      return "";
    }
  }

  const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_STATIC_KEY as string | undefined;
  function mapUrl(coord?: string) {
    if (!coord || !GMAPS_KEY) return "";
    const q = encodeURIComponent(coord);
    return `https://maps.googleapis.com/maps/api/staticmap?center=${q}&zoom=16&size=320x200&markers=color:red%7C${q}&key=${GMAPS_KEY}`;
  }

  function toLatLonPair(coord?: string): [number, number] | null {
    if (!coord) return null;
    const parts = coord.split(',');
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

  function maxDistanceKm(): number {
    const v = (process.env.NEXT_PUBLIC_MAX_DISTANCE_KM as unknown as string) || "0.5";
    const n = Number(v);
    return isFinite(n) && n > 0 ? n : 0.5;
  }

  function getCheckoutDistanceKm(coord = checkoutGps): number | null {
    const a = toLatLonPair(gps);
    const b = toLatLonPair(coord);
    if (!a || !b) return null;
    return distanceKm(a, b);
  }

  function hasAnyDraftContent() {
    return Boolean(
      locationName.trim() ||
      jobDetail.trim() ||
      gps.trim() ||
      checkoutGps.trim() ||
      photoFile ||
      checkoutPhotoFile ||
      problemDetail.trim() ||
      jobRemark.trim() ||
      checkoutRemark.trim()
    );
  }

  function buildDraftPayload() {
    return {
      checkinTime,
      checkoutTime,
      locationName,
      gps,
      gpsStatus,
      gpsAccuracy,
      gpsAttempts: checkinGpsAttempts,
      checkinCaptureAt,
      checkinAddress,
      jobDetail,
      checkinReviewNote,
      photo: fileToDraft(photoFile),
      checkoutGps,
      checkoutAddress,
      checkoutGpsStatus,
      checkoutGpsAccuracy,
      checkoutGpsAttempts,
      checkoutRemark,
      problemDetail,
      jobRemark,
      checkoutReviewNote,
      checkoutPhoto: fileToDraft(checkoutPhotoFile),
    };
  }

  const hasReliableCheckinGps = gps.trim().length > 0 && isReliableAccuracy(gpsAccuracy);
  const hasReliableCheckoutGps = checkoutGps.trim().length > 0 && isReliableAccuracy(checkoutGpsAccuracy);

  function updateCheckoutDistanceState(coord: string) {
    const a = toLatLonPair(gps);
    const b = toLatLonPair(coord);
    if (!a || !b) return false;
    const d = distanceKm(a, b);
    const threshold = maxDistanceKm();
    if (d > threshold) {
      const meters = Math.round(d * 1000);
      setCheckoutRemark(`จุดออกงานห่างจากจุดเข้างานประมาณ ${meters} เมตร`);
      setCheckoutOutOfArea(true);
      return true;
    }
    setCheckoutRemark("");
    setCheckoutOutOfArea(false);
    return false;
  }

  async function applyCheckoutLocation(location: CapturedLocation) {
    setCheckoutGps(location.coord);
    setCheckoutGpsAccuracy(location.accuracy);
    setCheckoutGpsStatus(getAccuracyStatusText(location.accuracy));
    setCheckoutMapFailed(false);
    const addr = await reverseGeocode(location.lat, location.lon);
    setCheckoutAddress(addr || "");
    return updateCheckoutDistanceState(location.coord);
  }

  const checkinReviewDecision = evaluatePendingReviewOption({
    gps,
    accuracy: gpsAccuracy,
    retries: checkinGpsAttempts,
    note: checkinReviewNote,
    hasPhoto: !!photoFile,
  });

  const checkoutReviewDecision = evaluatePendingReviewOption({
    gps: checkoutGps,
    accuracy: checkoutGpsAccuracy,
    retries: checkoutGpsAttempts,
    note: checkoutReviewNote,
    hasPhoto: !!checkoutPhotoFile,
    distanceKm: getCheckoutDistanceKm(),
    maxDistanceKm: maxDistanceKm(),
  });

  async function applyDraftFromStorage() {
    const draft = await loadTaskDraft(draftKey).catch(() => null);
    if (!draft) return false;
    if (draft.checkinTime) setCheckinTime(draft.checkinTime);
    if (draft.checkoutTime) setCheckoutTime(draft.checkoutTime);
    if (draft.locationName) setLocationName(draft.locationName);
    if (draft.gps) setGps(draft.gps);
    if (draft.gpsStatus) setGpsStatus(draft.gpsStatus);
    if (typeof draft.gpsAccuracy === "number") setGpsAccuracy(draft.gpsAccuracy);
    if (typeof draft.gpsAttempts === "number") setCheckinGpsAttempts(draft.gpsAttempts);
    if (typeof draft.checkinCaptureAt === "number") setCheckinCaptureAt(draft.checkinCaptureAt);
    if (draft.checkinAddress) setCheckinAddress(draft.checkinAddress);
    if (draft.jobDetail) setJobDetail(draft.jobDetail);
    if (draft.checkinReviewNote) setCheckinReviewNote(draft.checkinReviewNote);
    if (draft.checkoutGps) setCheckoutGps(draft.checkoutGps);
    if (draft.checkoutAddress) setCheckoutAddress(draft.checkoutAddress);
    if (draft.checkoutGpsStatus) setCheckoutGpsStatus(draft.checkoutGpsStatus);
    if (typeof draft.checkoutGpsAccuracy === "number") setCheckoutGpsAccuracy(draft.checkoutGpsAccuracy);
    if (typeof draft.checkoutGpsAttempts === "number") setCheckoutGpsAttempts(draft.checkoutGpsAttempts);
    if (draft.checkoutRemark) setCheckoutRemark(draft.checkoutRemark);
    if (draft.problemDetail) setProblemDetail(draft.problemDetail);
    if (draft.jobRemark) setJobRemark(draft.jobRemark);
    if (draft.checkoutReviewNote) setCheckoutReviewNote(draft.checkoutReviewNote);
    const draftPhoto = draftToFile(draft.photo);
    if (draftPhoto) {
      setPhotoFile(draftPhoto);
      setPhotoUrl(URL.createObjectURL(draftPhoto));
    }
    const draftCheckoutPhoto = draftToFile(draft.checkoutPhoto);
    if (draftCheckoutPhoto) {
      setCheckoutPhotoFile(draftCheckoutPhoto);
      setCheckoutPhotoUrl(URL.createObjectURL(draftCheckoutPhoto));
    }
    setDraftNotice("พบข้อมูลที่บันทึกไว้ในเครื่อง ระบบนำกลับมาให้แล้ว");
    return true;
  }

  async function clearSavedDraft(showMessage = true) {
    await deleteTaskDraft(draftKey);
    setDraftNotice("");
    if (showMessage) alert("ลบข้อมูลที่บันทึกไว้แล้ว");
  }

  async function saveDraftAndLeave() {
    if (!hasAnyDraftContent()) {
      alert("ยังไม่มีข้อมูลให้บันทึก");
      return;
    }
    try {
      await saveTaskDraft(draftKey, buildDraftPayload());
      setDraftNotice("บันทึกข้อมูลไว้ในเครื่องแล้ว");
      alert("บันทึกไว้ในเครื่องแล้ว ยังไม่ส่งเข้าระบบ กลับมาทำต่อภายหลังได้");
      router.replace("/checkin");
    } catch (e: any) {
      alert(e?.message || "บันทึกชั่วคราวไม่สำเร็จ");
    }
  }

  function todayLocalDate(): string {
    const now = new Date();
    const isoLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();
    return isoLocal.slice(0, 10);
  }

  const checkinDateOnly = useMemo(() => (checkinTime ? String(checkinTime).slice(0, 10) : ""), [checkinTime]);
  const canCheckoutSameDate = useMemo(() => hasExistingCheckin && checkinDateOnly === todayLocalDate(), [hasExistingCheckin, checkinDateOnly]);

  async function captureGPS() {
    setCheckinGpsAttempts((v) => v + 1);
    setGpsStatus("กำลังหาตำแหน่ง...");
    try {
      const location = await captureBestLocation();
      setGps(location.coord);
      setGpsAccuracy(location.accuracy);
      setGpsStatus(getAccuracyStatusText(location.accuracy));
      setCheckinCaptureAt(location.capturedAt);
      setCheckinMapFailed(false);
    } catch (e: any) {
      if (!gps.trim()) setGpsAccuracy(null);
      setGpsStatus(e?.message || "ยังหาตำแหน่งไม่เจอ กรุณากดลองใหม่");
    }
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setPhotoUrl(url);
    setPhotoFile(f);
    const ms = typeof f.lastModified === 'number' && f.lastModified > 0 ? f.lastModified : Date.now();
    setCheckinPhotoTakenAt(ms);
    try {
      const isoLocal = new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16);
      setCheckinTime(isoLocal);
    } catch {}
  }

  async function captureCheckoutGPS() {
    setCheckoutGpsAttempts((v) => v + 1);
    setCheckoutGpsStatus("กำลังหาตำแหน่ง...");
    try {
      const location = await captureBestLocation();
      return await applyCheckoutLocation(location);
    } catch (e: any) {
      if (!checkoutGps.trim()) setCheckoutGpsAccuracy(null);
      setCheckoutGpsStatus(e?.message || "ยังหาตำแหน่งไม่เจอ กรุณากดลองใหม่");
      return false;
    }
  }

  function onPickCheckoutPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setCheckoutPhotoUrl(url);
    setCheckoutPhotoFile(f);
    const ms = typeof f.lastModified === 'number' && f.lastModified > 0 ? f.lastModified : Date.now();
    setCheckoutPhotoTakenAt(ms);
    try {
      const isoLocal = new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16);
      setCheckoutTime(isoLocal);
    } catch {}
  }

  function onCheckout() {
    // Prevent cross-day checkout: must be same local date as check-in
    if (!canCheckoutSameDate) {
      alert("ไม่อนุญาตให้เช็คเอาท์ข้ามวัน กรุณาสร้างงานใหม่สำหรับวันนี้");
      return;
    }
    const now = new Date();
    const isoLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setCheckoutTime(isoLocal);
    setCheckoutRemark("");
    void captureCheckoutGPS().then((isOutOfArea) => {
      if (isOutOfArea) {
        alert("จุดออกงานห่างจากจุดเข้างานมากเกินไป กรุณาลองใหม่");
      }
    });
  }

  async function retryCheckoutGps() {
    const isOutOfArea = await captureCheckoutGPS();
    if (isOutOfArea) {
      alert("จุดออกงานห่างจากจุดเข้างานมากเกินไป กรุณาลองใหม่");
    }
  }

async function onSubmitCheckin() {
    try {
      // Fast guard against rapid double-clicks
      if (checkinLockRef.current) return;
      checkinLockRef.current = true;
      setIsSubmitting(true);
      if (!hasExistingCheckin && checkinCaptureAt != null && Date.now() - checkinCaptureAt > 5 * 60 * 1000) {
        alert("หมดเวลายืนยันตำแหน่ง กรุณาจับพิกัดใหม่");
        return;
      }
      if (!hasExistingCheckin && !hasReliableCheckinGps) {
        alert(gps.trim() ? "ตำแหน่งยังไม่ชัด กรุณากดจับพิกัดอีกครั้ง" : "ยังหาตำแหน่งไม่เจอ กรุณากดลองใหม่");
        return;
      }
      if (!locationName.trim()) {
        alert("กรุณากรอกชื่อสถานที่");
        return;
      }
      if (!photoFile) {
        alert("กรุณาถ่ายรูปเข้างาน");
        return;
      }
      let uploadedUrl: string | null = null;
      if (photoFile) uploadedUrl = await uploadPhoto(photoFile);
      // Use photo capture time if available; otherwise current time
      const ms = checkinPhotoTakenAt ?? Date.now();
      const isoLocal = new Date(ms - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setCheckinTime(isoLocal);
      const resp = await submitCheckin({
        id,
        checkin: isoLocal,
        locationName,
        gps,
        checkinAddress,
        jobDetail,
        photoUrl: uploadedUrl,
      });
      await deleteTaskDraft(draftKey);
      setDraftNotice("");
      const st = resp?.status ? String(resp.status) : "";
      alert(st ? `บันทึกแล้ว (${st})` : "บันทึกแล้ว");
      setHasExistingCheckin(true);
      router.replace("/checkin");
    } catch (e: any) {
      alert(e?.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
      checkinLockRef.current = false;
    }
  }

  async function onSubmitCheckinForReview() {
    try {
      if (checkinLockRef.current) return;
      if (!checkinReviewDecision.allowed) {
        alert(checkinReviewDecision.message || "ยังส่งให้หัวหน้าตรวจไม่ได้");
        return;
      }
      checkinLockRef.current = true;
      setIsSubmitting(true);
      if (!locationName.trim()) {
        alert("กรุณากรอกชื่อสถานที่");
        return;
      }
      if (!photoFile) {
        alert("กรุณาถ่ายรูปเข้างาน");
        return;
      }
      const uploadedUrl = await uploadPhoto(photoFile);
      const ms = checkinPhotoTakenAt ?? Date.now();
      const isoLocal = new Date(ms - new Date().getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setCheckinTime(isoLocal);
      const resp = await submitCheckin({
        id,
        checkin: isoLocal,
        locationName,
        gps,
        checkinAddress,
        jobDetail,
        photoUrl: uploadedUrl,
        reviewStatus: "pending_review",
        signalIssueReason: checkinReviewNote.trim(),
        gpsAccuracy,
        gpsRetryCount: checkinGpsAttempts,
      });
      await deleteTaskDraft(draftKey);
      setDraftNotice("");
      const st = resp?.status ? String(resp.status) : "";
      alert(st ? `ส่งให้หัวหน้าตรวจแล้ว (${st})` : "ส่งให้หัวหน้าตรวจแล้ว");
      setHasExistingCheckin(true);
      router.replace("/checkin");
    } catch (e: any) {
      alert(e?.message || "ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
      checkinLockRef.current = false;
    }
  }

  async function onSubmitCheckout() {
    try {
      // Fast guard against rapid double-clicks
      if (checkoutLockRef.current) return;
      checkoutLockRef.current = true;
      setIsSubmitting(true);
      if (!locationName.trim()) {
        alert("กรุณากรอกชื่อสถานที่");
        setIsSubmitting(false);
        return;
      }
      if (!hasReliableCheckoutGps) {
        alert(checkoutGps.trim() ? "ตำแหน่งออกงานยังไม่ชัด กรุณากดลองใหม่" : "ยังหาตำแหน่งออกงานไม่เจอ กรุณากดลองใหม่");
        setIsSubmitting(false);
        return;
      }
      if (!checkoutPhotoFile) {
        alert("กรุณาถ่ายรูปออกงาน");
        setIsSubmitting(false);
        return;
      }
      // Validate distance before submit
      const a = toLatLonPair(gps);
      const b = toLatLonPair(checkoutGps);
      if (a && b) {
        const d = distanceKm(a, b);
        const threshold = maxDistanceKm();
        if (d > threshold) {
          setCheckoutOutOfArea(true);
          alert("จุดออกงานห่างจากจุดเข้างานมากเกินไป กรุณาลองใหม่");
          setIsSubmitting(false);
          return;
        }
      }
      let uploadedUrl: string | null = null;
      if (checkoutPhotoFile) uploadedUrl = await uploadPhoto(checkoutPhotoFile);
      const resp = await submitCheckout({
        id,
        checkout: (() => { const ms = checkoutPhotoTakenAt ?? Date.now(); return new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16); })(),
        checkoutGps,
        checkoutAddress,
        locationName,
        checkoutPhotoUrl: uploadedUrl,
        checkoutRemark,
        problemDetail,
        problem: problemDetail,
        jobRemark,
        remark: jobRemark,
      });
      await deleteTaskDraft(draftKey);
      setDraftNotice("");
      const st = resp?.status ? String(resp.status) : "";
      alert(st ? `บันทึกแล้ว (${st})` : "บันทึกแล้ว");
      setHasExistingCheckout(true);
      router.replace("/checkin");
    } catch (e: any) {
      alert(e?.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
      checkoutLockRef.current = false;
    }
  }

  async function onSubmitCheckoutForReview() {
    try {
      if (checkoutLockRef.current) return;
      if (!checkoutReviewDecision.allowed) {
        alert(checkoutReviewDecision.message || "ยังส่งให้หัวหน้าตรวจไม่ได้");
        return;
      }
      checkoutLockRef.current = true;
      setIsSubmitting(true);
      if (!locationName.trim()) {
        alert("กรุณากรอกชื่อสถานที่");
        return;
      }
      if (!checkoutPhotoFile) {
        alert("กรุณาถ่ายรูปออกงาน");
        return;
      }
      const uploadedUrl = await uploadPhoto(checkoutPhotoFile);
      const resp = await submitCheckout({
        id,
        checkout: (() => {
          const ms = checkoutPhotoTakenAt ?? Date.now();
          return new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        })(),
        checkoutGps,
        checkoutAddress,
        locationName,
        checkoutPhotoUrl: uploadedUrl,
        checkoutRemark,
        problemDetail,
        problem: problemDetail,
        jobRemark,
        remark: jobRemark,
        reviewStatus: "pending_review",
        reviewReason: checkoutReviewDecision.reason,
        signalIssueReason: checkoutReviewNote.trim(),
        gpsAccuracy: checkoutGpsAccuracy,
        gpsRetryCount: checkoutGpsAttempts,
      });
      await deleteTaskDraft(draftKey);
      setDraftNotice("");
      const st = resp?.status ? String(resp.status) : "";
      alert(st ? `ส่งให้หัวหน้าตรวจแล้ว (${st})` : "ส่งให้หัวหน้าตรวจแล้ว");
      setHasExistingCheckout(true);
      router.replace("/checkin");
    } catch (e: any) {
      alert(e?.message || "ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
      checkoutLockRef.current = false;
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      <div className="mx-auto w-full px-4 sm:px-6 md:px-8 pt-4 pb-10 max-w-sm sm:max-w-md md:max-w-2xl">
        {/* Header with back icon */}
        <div className="mb-2 flex items-center gap-2">
          <Link
            href="/checkin"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-black/20 bg-white hover:bg-gray-50"
            title="ย้อนกลับ"
          >
            <span className="text-xl">←</span>
          </Link>
          <h1 className="mx-auto text-xl sm:text-2xl md:text-3xl font-extrabold text-center">
            {displayTitle}
          </h1>
        </div>

        {draftNotice ? (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <div>{draftNotice}</div>
            <button
              type="button"
              onClick={() => void clearSavedDraft()}
              className="mt-2 inline-flex rounded-full border border-amber-400 bg-white px-3 py-1 text-xs hover:bg-amber-100"
            >
              ลบข้อมูลที่บันทึกไว้
            </button>
          </div>
        ) : null}

        {/* Check-in time */}
        <div className="mt-3">
          <div className="text-sm sm:text-base font-semibold">เวลาเข้างาน (อัตโนมัติ)</div>
          <div className="mt-1">
            <Input
              type="datetime-local"
              value={checkinTime}
              readOnly
              className="rounded-full border-black/10 bg-[#D8CBAF]/60 h-10 sm:h-11"
              disabled
            />
          </div>
        </div>

        <div className="mt-4">
          <div className="text-sm sm:text-base font-semibold">สถานที่</div>
          <div className="mt-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="text-sm sm:text-base font-semibold text-gray-900">
                {gps ? "พิกัดล่าสุด" : "ยังไม่ได้รับพิกัด"}
              </div>
              <div className="flex gap-2 sm:ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-black/20 bg-white hover:bg-gray-50"
                  onClick={captureGPS}
                  disabled={hasExistingCheckin || isSubmitting}
                  title={hasExistingCheckin ? "บันทึกพิกัดเรียบร้อย" : "จับพิกัดปัจจุบันอีกครั้ง"}
                >
                  จับพิกัดอีกครั้ง
                </Button>
                <button
                  type="button"
                  onClick={() => setShowDetails((v) => !v)}
                  className="inline-flex items-center justify-center rounded-full border border-black/20 bg-white px-2 py-1 text-xs hover:bg-gray-50"
                >
                  {showDetails ? "ซ่อนแผนที่" : "แสดงแผนที่"}
                </button>
              </div>
            </div>
            <div className="mt-2 rounded-md border border-black/10 bg-[#BFD9C8] p-3 sm:p-4 min-h-[120px]">
              <div className="text-sm sm:text-base font-semibold break-words">
                พิกัด: {gps || "—"}
              </div>
              <div className={`mt-2 text-xs ${hasExistingCheckin || hasReliableCheckinGps ? "text-green-800" : gps ? "text-amber-800" : "text-gray-700"}`}>

                {gpsStatus || (gps ? "บันทึกตำแหน่งไว้แล้ว" : "กำลังหาตำแหน่ง...")}

              </div>

              {showDetails && gps && GMAPS_KEY && !checkinMapFailed ? (
                <div className="mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mapUrl(gps)}
                    alt="check-in map"
                    className="rounded border border-black/10"
                    onError={() => setCheckinMapFailed(true)}
                  />
                </div>
              ) : null}

              {showDetails && gps && (checkinMapFailed || !GMAPS_KEY) ? (

                <div className="mt-2 rounded border border-dashed border-black/20 bg-white/70 px-3 py-2 text-xs text-gray-700">

                  แผนที่ไม่ขึ้น แต่บันทึกตำแหน่งได้แล้ว

                </div>

              ) : null}
              <div className="mt-2 text-xs text-gray-700">
                {gps ? getAccuracyHelpText(gpsAccuracy) : "ถ้ารอนาน ให้ขยับไปที่โล่งหรือใกล้หน้าต่าง แล้วกดจับพิกัดอีกครั้ง"}
              </div>
            </div>
          </div>
        </div>

        {/* Location Detail */}
        <div className="mt-5">
          <div className="text-sm sm:text-base font-semibold">รายละเอียดสถานที่</div>
          <Textarea
            value={jobDetail}
            onChange={(e) => setJobDetail(e.target.value)}
            className="mt-2 min-h-[160px] sm:min-h-[180px] border-black/10 bg-[#BFD9C8]"
            disabled={hasExistingCheckin || isSubmitting}
          />
          <div className="mt-1 text-xs text-gray-700">ข้อความนี้จะถูกใช้เป็นชื่อสถานที่ในรายงาน</div>
        </div>

        {/* Take a picture */}
        <div className="mt-3 rounded-md border border-black/10 bg-[#D8CBAF]/70 px-4 py-2 text-center font-semibold">
          <span className="text-sm sm:text-base">ถ่ายรูป</span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="ml-2 inline-flex items-center justify-center rounded-full border border-black/30 bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            title="เปิดกล้อง"
            disabled={hasExistingCheckin || isSubmitting}
          >
            📷 ถ่ายรูป
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*;capture=camera"
            capture="environment"
            className="hidden"
            onChange={onPickPhoto}
            disabled={hasExistingCheckin || isSubmitting}
          />
        </div>

        {/* Status label */}
        <div className="-mt-1 mb-2 flex justify-center">
          {hasExistingCheckin ? (
            hasExistingCheckout ? (
              <span className="inline-flex items-center rounded-full bg-[#6EC3A1] text-white px-3 py-1 text-xs sm:text-sm">เสร็จสิ้น</span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-[#E7D6B9] text-black px-3 py-1 text-xs sm:text-sm">กำลังทำ</span>
            )
          ) : (
            <span className="inline-flex items-center rounded-full bg-gray-200 text-gray-800 px-3 py-1 text-xs sm:text-sm">ยังไม่เริ่ม</span>
          )}
        </div>

        {/* Photo preview (kept stable with aspect ratio) */}
        <div className="mt-3 overflow-hidden rounded-md border border-black/10 bg-[#BFD9C8]">
          <div className="relative w-full aspect-video">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="preview" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-4 text-sm sm:text-base text-gray-700">
                ไม่มีรูปภาพ
              </div>
            )}
          </div>
        </div>
        {!photoFile && !hasExistingCheckin && !isSubmitting ? (
          <div className="mt-1 text-xs text-red-700">ต้องถ่ายรูปเข้างาน</div>
        ) : null}

        {gps.trim() && !hasReliableCheckinGps && !hasExistingCheckin ? (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-3">
            <div className="text-sm font-semibold text-amber-900">ถ้าสัญญาณไม่ดีจริงๆ</div>
            <div className="mt-1 text-xs text-amber-900">
              ลองจับพิกัดอีกครั้งก่อน ถ้ายังไม่ได้ ให้พิมพ์เหตุผลสั้นๆ แล้วส่งให้หัวหน้าตรวจ
            </div>
            <Input
              placeholder="เช่น อยู่ในอาคาร สัญญาณอ่อน"
              value={checkinReviewNote}
              onChange={(e) => setCheckinReviewNote(e.target.value)}
              className="mt-2 rounded-full border-amber-300 bg-white h-10"
              disabled={isSubmitting}
            />
            <div className="mt-2 text-xs text-amber-900">
              {checkinReviewDecision.allowed ? "ส่งให้หัวหน้าตรวจได้" : checkinReviewDecision.message}
            </div>
          </div>
        ) : null}

        {/* Actions */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <LoadingButton
            onClick={onSubmitCheckin}
            disabled={hasExistingCheckin || !locationName.trim() || !photoFile || isSubmitting || (!hasExistingCheckin && checkinCaptureAt != null && Date.now() - checkinCaptureAt > 5 * 60 * 1000) || (!hasExistingCheckin && !hasReliableCheckinGps)}
            className="w-full rounded-full bg-[#BFD9C8] px-6 text-gray-900 hover:bg-[#b3d0bf] border border-black/20 disabled:opacity-60 disabled:cursor-not-allowed"
            title={
              !locationName.trim()
                ? "กรุณาระบุชื่อสถานที่"
                : !hasExistingCheckin && !hasReliableCheckinGps
                  ? gps.trim()
                    ? "ตำแหน่งยังไม่ชัด กรุณาจับพิกัดใหม่"
                    : "กำลังหาตำแหน่งอยู่ กรุณารอสักครู่"
                  : !photoFile
                    ? "กรุณาถ่ายรูปเพื่อเข้างาน"
                    : hasExistingCheckin
                      ? "บันทึกเข้างานแล้ว"
                      : undefined
            }
            loading={isSubmitting}
            loadingLabel="กำลังบันทึก..."
          >
            บันทึกเข้างาน
          </LoadingButton>
          {!hasExistingCheckin ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void saveDraftAndLeave()}
              disabled={isSubmitting || !hasAnyDraftContent()}
              className="w-full rounded-full border-black/20 bg-white hover:bg-gray-50"
              title="บันทึกข้อมูลไว้ในเครื่อง แล้วค่อยกลับมาทำต่อ"
            >
              บันทึกไว้ก่อน
            </Button>
          ) : null}
          {hasExistingCheckin && canCheckoutSameDate ? (
            <Button
              onClick={onCheckout}
              className="w-full rounded-full bg-[#E8CC5C] px-6 text-gray-900 hover:bg-[#e3c54a] border border-black/20 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={hasExistingCheckout || isSubmitting}
            >
              ออกงาน
            </Button>
          ) : null}
          {hasExistingCheckin && !canCheckoutSameDate ? (
            <div className="text-center text-xs sm:text-sm text-red-700">ไม่สามารถออกงานข้ามวันได้</div>
          ) : null}
        </div>
        {gps.trim() && !hasReliableCheckinGps && !hasExistingCheckin ? (
          <Button
            type="button"
            onClick={onSubmitCheckinForReview}
            disabled={isSubmitting || !checkinReviewDecision.allowed}
            className="mt-3 w-full rounded-full bg-[#D8CBAF] text-gray-900 hover:bg-[#ccb995] border border-black/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            ส่งให้หัวหน้าตรวจ
          </Button>
        ) : null}

        {/* Check-out time (auto) */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <div className="text-sm sm:text-base font-semibold">เวลาออกงาน (อัตโนมัติ)</div>
          <Input
            type="datetime-local"
            value={checkoutTime}
            readOnly
            className="rounded-full border-black/10 bg-[#D8CBAF]/60 h-10 sm:h-11 w-full sm:w-[260px]"
            disabled
          />
        </div>

        {/* Checkout GPS and Photo (shown after checkout time set) */}
        {checkoutTime && (
          <>
            {/* Checkout GPS */}
            <div className="mt-4">
              <div className="text-sm sm:text-base font-semibold">พิกัดออกงาน</div>
              <div className="mt-2 rounded-md border border-black/10 bg-[#BFD9C8] p-3 sm:p-4">
                <div className="text-sm sm:text-base break-words">{checkoutGps || "ยังไม่ได้รับพิกัด"}</div>
                <div className={`mt-2 text-xs ${hasExistingCheckout || hasReliableCheckoutGps ? "text-green-800" : checkoutGps ? "text-amber-800" : "text-gray-700"}`}>
                  {checkoutGpsStatus || (checkoutGps ? "บันทึกตำแหน่งไว้แล้ว" : "กดออกงานเพื่อจับพิกัด")}
                </div>
                {checkoutAddress ? (
                  <div className="mt-1 text-xs sm:text-sm text-gray-700 break-words" title={checkoutAddress}>
                    {checkoutAddress}
                  </div>
                ) : null}
                {checkoutGps && GMAPS_KEY && !checkoutMapFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={mapUrl(checkoutGps)}
                    alt="checkout map"
                    className="mt-2 rounded border border-black/10"
                    onError={() => setCheckoutMapFailed(true)}
                  />
                ) : null}
                {checkoutGps && (checkoutMapFailed || !GMAPS_KEY) ? (
                  <div className="mt-2 rounded border border-dashed border-black/20 bg-white/70 px-3 py-2 text-xs text-gray-700">
                    แผนที่ไม่ขึ้น แต่บันทึกตำแหน่งได้แล้ว
                  </div>
                ) : null}
                {checkoutOutOfArea ? (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="rounded border border-red-300 bg-red-100 px-3 py-1 text-xs sm:text-sm text-red-800">
                      จุดออกงานห่างจากจุดเข้างานมากเกินไป
                    </div>
                    <button
                      type="button"
                      onClick={retryCheckoutGps}
                      className="inline-flex items-center justify-center h-7 rounded-full border border-black/20 bg-white px-2 text-xs hover:bg-gray-50"
                    >
                      ลองใหม่
                    </button>
                  </div>
                ) : null}
                {checkoutRemark ? (
                  <div className="mt-2 text-xs text-red-700">{checkoutRemark}</div>
                ) : null}
                <div className="mt-2 text-xs text-gray-700">
                  {checkoutGps ? getAccuracyHelpText(checkoutGpsAccuracy) : "ถ้ารอนาน ให้ขยับไปที่โล่งหรือใกล้หน้าต่าง แล้วกดลองใหม่"}
                </div>
              </div>
            </div>

            {/* Problem and Remark inputs */}
            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <div className="text-sm sm:text-base font-semibold">ปัญหาที่พบเจอ/OOS</div>
                <Input
                  placeholder="รายละเอียดปัญหาในการทำงาน (ถ้ามี)"
                  value={problemDetail}
                  onChange={(e) => setProblemDetail(e.target.value)}
                  className="mt-1 rounded-full border-black/10 bg-[#D8CBAF]/60 h-10 sm:h-11"
                  disabled={hasExistingCheckout || isSubmitting}
                />
              </div>
              <div>
                <div className="text-sm sm:text-base font-semibold">หมายเหตุ</div>
                <Input
                  placeholder="เหตุผลเช็คเอาท์ช้า/เร็วกว่าปกติ (ถ้ามี)"
                  value={jobRemark}
                  onChange={(e) => setJobRemark(e.target.value)}
                  className="mt-1 rounded-full border-black/10 bg-[#D8CBAF]/60 h-10 sm:h-11"
                  disabled={hasExistingCheckout || isSubmitting}
                />
              </div>
            </div>

            {/* Checkout Take a picture */}
            <div className="mt-3 rounded-md border border-black/10 bg-[#D8CBAF]/70 px-4 py-2 text-center font-semibold">
              <span className="text-sm sm:text-base">ถ่ายรูป</span>
              <button
                type="button"
                onClick={() => checkoutFileRef.current?.click()}
                className="ml-2 inline-flex items-center justify-center rounded-full border border-black/30 bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                title="เปิดกล้อง"
                disabled={hasExistingCheckout || isSubmitting}
              >
                📷 ถ่ายรูป
              </button>
              <input
                ref={checkoutFileRef}
                type="file"
                accept="image/*;capture=camera"
                capture="environment"
                className="hidden"
                onChange={onPickCheckoutPhoto}
                disabled={hasExistingCheckout || isSubmitting}
              />
            </div>

            {/* Checkout Photo preview */}
            <div className="mt-3 overflow-hidden rounded-md border border-black/10 bg-[#BFD9C8]">
              <div className="relative w-full aspect-video">
                {checkoutPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={checkoutPhotoUrl} alt="checkout preview" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-4 text-sm sm:text-base text-gray-700">
                    ไม่มีรูปภาพ
                  </div>
                )}
              </div>
            </div>
            {!checkoutPhotoFile && !hasExistingCheckout && !isSubmitting ? (
              <div className="mt-1 text-xs text-red-700">ต้องถ่ายรูปออกงาน</div>
            ) : null}

            {checkoutGps.trim() && !hasReliableCheckoutGps && !hasExistingCheckout ? (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-3">
                <div className="text-sm font-semibold text-amber-900">ถ้าสัญญาณไม่ดีจริงๆ</div>
                <div className="mt-1 text-xs text-amber-900">
                  ถ้ายังจับพิกัดได้ไม่ชัด ให้พิมพ์เหตุผลสั้นๆ แล้วส่งให้หัวหน้าตรวจ
                </div>
                <Input
                  placeholder="เช่น อยู่ในอาคาร สัญญาณอ่อน"
                  value={checkoutReviewNote}
                  onChange={(e) => setCheckoutReviewNote(e.target.value)}
                  className="mt-2 rounded-full border-amber-300 bg-white h-10"
                  disabled={isSubmitting || hasExistingCheckout}
                />
                <div className="mt-2 text-xs text-amber-900">
                  {checkoutReviewDecision.allowed ? "ส่งให้หัวหน้าตรวจได้" : checkoutReviewDecision.message}
                </div>
              </div>
            ) : null}

            {/* Submit Checkout */}
            <div className="mt-4">
              <LoadingButton
                onClick={onSubmitCheckout}
                disabled={hasExistingCheckout || !locationName.trim() || !checkoutPhotoFile || checkoutOutOfArea || isSubmitting || !hasReliableCheckoutGps}
                className="w-full rounded-full bg-[#E8CC5C] px-6 text-gray-900 hover:bg-[#e3c54a] border border-black/20 disabled:opacity-60 disabled:cursor-not-allowed"
                loading={isSubmitting}
                loadingLabel="กำลังบันทึก..."
                title={
                  !locationName.trim()
                    ? "กรุณาระบุชื่อสถานที่"
                    : !hasReliableCheckoutGps
                      ? checkoutGps.trim()
                        ? "ตำแหน่งออกงานยังไม่ชัด กรุณาลองใหม่"
                        : "กำลังหาตำแหน่งออกงานอยู่ กรุณารอสักครู่"
                      : !checkoutPhotoFile
                        ? "กรุณาถ่ายรูปออกงาน"
                        : checkoutOutOfArea
                          ? "จุดออกงานห่างจากจุดเข้างานมากเกินไป"
                          : undefined
                }
              >
                บันทึกออกงาน
              </LoadingButton>
              <Button
                type="button"
                variant="outline"
                onClick={() => void saveDraftAndLeave()}
                disabled={isSubmitting || !hasAnyDraftContent()}
                className="mt-3 w-full rounded-full border-black/20 bg-white hover:bg-gray-50"
              >
                บันทึกไว้ก่อน
              </Button>
              {checkoutGps.trim() && !hasReliableCheckoutGps && !hasExistingCheckout ? (
                <Button
                  type="button"
                  onClick={onSubmitCheckoutForReview}
                  disabled={isSubmitting || !checkoutReviewDecision.allowed}
                  className="mt-3 w-full rounded-full bg-[#D8CBAF] text-gray-900 hover:bg-[#ccb995] border border-black/20 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  ส่งให้หัวหน้าตรวจ
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}




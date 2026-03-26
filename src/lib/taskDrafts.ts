export type DraftFile = {
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
};

export type TaskDraft = {
  key: string;
  updatedAt: number;
  checkinTime?: string;
  checkoutTime?: string;
  locationName?: string;
  gps?: string;
  gpsStatus?: string;
  gpsAccuracy?: number | null;
  gpsAttempts?: number | null;
  checkinCaptureAt?: number | null;
  checkinAddress?: string;
  jobDetail?: string;
  checkinReviewNote?: string;
  photo?: DraftFile | null;
  checkoutGps?: string;
  checkoutAddress?: string;
  checkoutGpsStatus?: string;
  checkoutGpsAccuracy?: number | null;
  checkoutGpsAttempts?: number | null;
  checkoutRemark?: string;
  problemDetail?: string;
  jobRemark?: string;
  checkoutReviewNote?: string;
  checkoutPhoto?: DraftFile | null;
};

const DB_NAME = "ncp-sales-checkin";
const STORE_NAME = "task-drafts";

function hasIndexedDb() {
  return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open draft database"));
  });
}

function requestToPromise<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export function fileToDraft(file: File | null): DraftFile | null {
  if (!file) return null;
  return {
    blob: file,
    name: file.name || `draft-${Date.now()}.jpg`,
    type: file.type || "image/jpeg",
    lastModified: typeof file.lastModified === "number" ? file.lastModified : Date.now(),
  };
}

export function draftToFile(file: DraftFile | null | undefined): File | null {
  if (!file?.blob) return null;
  return new File([file.blob], file.name || `draft-${Date.now()}.jpg`, {
    type: file.type || file.blob.type || "image/jpeg",
    lastModified: file.lastModified || Date.now(),
  });
}

export async function loadTaskDraft(key: string): Promise<TaskDraft | null> {
  if (!hasIndexedDb()) return null;
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const item = await requestToPromise<TaskDraft | undefined>(store.get(key));
    await transactionDone(tx);
    return item ?? null;
  } finally {
    db.close();
  }
}

export async function saveTaskDraft(key: string, data: Omit<TaskDraft, "key" | "updatedAt">): Promise<void> {
  if (!hasIndexedDb()) {
    throw new Error("โทรศัพท์เครื่องนี้ยังบันทึกชั่วคราวไม่ได้");
  }
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({
      key,
      updatedAt: Date.now(),
      ...data,
    } satisfies TaskDraft);
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

export async function deleteTaskDraft(key: string): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

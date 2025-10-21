async function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = reader.result as string;
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function resizeImageToJpegBase64(file: File, maxSide = 240, quality = 0.75): Promise<string> {
  // Use an offscreen canvas to resize to a smaller JPEG, keeping aspect ratio.
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = (e) => reject(new Error("Failed to load image"));
      i.src = url;
    });
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) {
      return await fileToBase64(file);
    }
    const scale = Math.min(1, maxSide / Math.max(iw, ih));
    const tw = Math.max(1, Math.round(iw * scale));
    const th = Math.max(1, Math.round(ih * scale));
    const canvas = document.createElement('canvas');
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext('2d');
    if (!ctx) return await fileToBase64(file);
    ctx.drawImage(img, 0, 0, tw, th);
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality);
    });
    return await fileToBase64(blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadPhoto(file: File): Promise<string> {
  // Guard extremely large files to avoid memory pressure in the browser
  const maxBytes = 8 * 1024 * 1024; // 8MB
  if (file.size > maxBytes) {
    throw new Error("Photo is too large. Please pick an image under 8MB.");
  }
  // Resize to a small 240p-ish long side before upload
  const b64 = await resizeImageToJpegBase64(file, 240, 0.75);
  const res = await fetch("/api/pa/upload-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: `task-${crypto.randomUUID()}.jpg`, contentBase64: b64 }),
  });
  const data = await res.json();
  if (!res.ok || !data?.url) throw new Error(data?.error || "Upload failed");
  return data.url as string;
}

export async function submitCheckin(payload: any): Promise<{ ok: true; status?: string }>{
  const res = await fetch("/api/pa/checkin", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null as any);
  if (!res.ok || !data?.ok) throw new Error(data?.error || "Check-in failed");
  return data as { ok: true; status?: string };
}

export async function submitCheckout(payload: any): Promise<{ ok: true; status?: string }>{
  const res = await fetch("/api/pa/checkout", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null as any);
  if (!res.ok || !data?.ok) throw new Error(data?.error || "Checkout failed");
  return data as { ok: true; status?: string };
}

export async function submitLeave(payload: any) {
  const res = await fetch("/api/pa/leave", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Leave submit failed");
}

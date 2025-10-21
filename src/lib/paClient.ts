async function fileToBase64(file: File): Promise<string> {
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

export async function uploadPhoto(file: File): Promise<string> {
  // Guard extremely large files to avoid memory pressure in the browser
  const maxBytes = 8 * 1024 * 1024; // 8MB
  if (file.size > maxBytes) {
    throw new Error("Photo is too large. Please pick an image under 8MB.");
  }
  const b64 = await fileToBase64(file);
  const res = await fetch("/api/pa/upload-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName: `task-${crypto.randomUUID()}.jpg`, contentBase64: b64 }),
  });
  const data = await res.json();
  if (!res.ok || !data?.url) throw new Error(data?.error || "Upload failed");
  return data.url as string;
}

export async function submitCheckin(payload: any) {
  const res = await fetch("/api/pa/checkin", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Check-in failed");
}

export async function submitCheckout(payload: any) {
  const res = await fetch("/api/pa/checkout", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Checkout failed");
}

export async function submitLeave(payload: any) {
  const res = await fetch("/api/pa/leave", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Leave submit failed");
}

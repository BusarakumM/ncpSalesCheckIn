export async function uploadPhoto(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  const res = await fetch("/api/pa/upload-photo", {
    method: "POST", headers: { "Content-Type": "application/json" },
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

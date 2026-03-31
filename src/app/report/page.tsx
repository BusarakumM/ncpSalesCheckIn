import { cookies } from "next/headers";
import ReportClient from "./report-client";

function getBangkokIsoDate() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const day = parts.find((part) => part.type === "day")?.value || "";
  return `${year}-${month}-${day}`;
}

export default async function ReportPage() {
  const role = (await cookies()).get("role")?.value;
  const email = (await cookies()).get("username")?.value || (await cookies()).get("email")?.value || "";
  const homeHref = role === "SUPERVISOR" ? "/supervisor" : "/home";
  return <ReportClient homeHref={homeHref} role={role as any} email={email} todayIso={getBangkokIsoDate()} />;
}

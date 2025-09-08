import { cookies } from "next/headers";
import ReportClient from "./report-client";

export default async function ReportPage() {
  const role = (await cookies()).get("role")?.value;
  const homeHref = role === "SUPERVISOR" ? "/supervisor" : "/home";
  return <ReportClient homeHref={homeHref} />;
}

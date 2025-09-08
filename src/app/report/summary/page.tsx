import { cookies } from "next/headers";
import SummaryClient from "./summary-client";

export default async function SummaryPage() {
  const role = (await cookies()).get("role")?.value;
  const homeHref = role === "SUPERVISOR" ? "/supervisor" : "/home";
  return <SummaryClient homeHref={homeHref} />;
}

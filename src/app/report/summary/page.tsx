import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SummaryClient from "./summary-client";

export default async function SummaryPage() {
  const role = (await cookies()).get("role")?.value;
  if (role !== "SUPERVISOR") {
    redirect("/home");
  }
  const homeHref = role === "SUPERVISOR" ? "/supervisor" : "/home";
  return <SummaryClient homeHref={homeHref} />;
}

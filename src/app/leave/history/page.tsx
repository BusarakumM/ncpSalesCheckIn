import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LeaveHistoryClient from "./history-client";

export default async function LeaveHistoryPage() {
  const c = await cookies();
  const role = c.get("role")?.value;

  if (role !== "SUPERVISOR") {
    redirect("/home");
  }

  const email = c.get("username")?.value || c.get("email")?.value || "";
  const employeeNo = c.get("employeeNo")?.value || "";
  return <LeaveHistoryClient email={email} employeeNo={employeeNo} />;
}

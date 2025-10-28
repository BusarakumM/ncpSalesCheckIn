import { cookies } from "next/headers";
import LeaveHistoryClient from "./history-client";

export default async function LeaveHistoryPage() {
  const c = await cookies();
  const email = c.get("username")?.value || c.get("email")?.value || "";
  const employeeNo = c.get("employeeNo")?.value || "";
  return <LeaveHistoryClient email={email} employeeNo={employeeNo} />;
}

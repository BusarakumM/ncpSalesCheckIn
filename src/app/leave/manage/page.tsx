import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LeaveManageClient from "./manage-client";

export default async function LeaveManagePage() {
  const role = (await cookies()).get("role")?.value;
  if (role !== "SUPERVISOR") {
    redirect("/home");
  }
  return <LeaveManageClient />;
}

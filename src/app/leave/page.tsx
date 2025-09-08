import { cookies } from "next/headers";
import LeaveClient from "./leave-client";

export default async function LeavePage() {
  const role = (await cookies()).get("role")?.value;
  const homeHref = role === "SUPERVISOR" ? "/supervisor" : "/home";
  return <LeaveClient homeHref={homeHref} />;
}

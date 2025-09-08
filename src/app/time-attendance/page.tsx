import { cookies } from "next/headers";
import TimeAttendanceClient from "./time-attendance-client";

export default async function TimeAttendancePage() {
  const role = (await cookies()).get("role")?.value;
  const homeHref = role === "SUPERVISOR" ? "/supervisor" : "/home";
  return <TimeAttendanceClient homeHref={homeHref} />;
}

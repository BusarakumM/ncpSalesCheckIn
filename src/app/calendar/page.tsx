import { cookies } from "next/headers";
import CalendarClient from "./calendar-client";

export default async function CalendarPage() {
  const role = (await cookies()).get("role")?.value;
  const homeHref = role === "SUPERVISOR" ? "/supervisor" : "/home";
  return <CalendarClient homeHref={homeHref} />;
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import CalendarClient from "./calendar-client";

export default async function CalendarPage() {
  const role = (await cookies()).get("role")?.value;
  if (role !== "SUPERVISOR") {
    redirect("/home");
  }
  const homeHref = role === "SUPERVISOR" ? "/supervisor" : "/home";
  return <CalendarClient homeHref={homeHref} />;
}

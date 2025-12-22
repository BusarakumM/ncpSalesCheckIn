import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ActivityClient from "./activity-client";

export default async function ActivityPage() {
  const c = await cookies();
  const role = c.get("role")?.value;
  const identity = c.get("username")?.value || c.get("email")?.value || "";

  // Non-supervisors must have an identity; otherwise redirect to sign-in.
  if (role !== "SUPERVISOR" && !identity) {
    redirect("/(auth)/sign-in");
  }

  const homeHref = role === "SUPERVISOR" ? "/supervisor" : "/home";
  return <ActivityClient homeHref={homeHref} />;
}

import { cookies } from "next/headers";
import ActivityClient from "./activity-client";

export default async function ActivityPage() {
  const role = (await cookies()).get("role")?.value;
  const homeHref = role === "SUPERVISOR" ? "/supervisor" : "/home";
  return <ActivityClient homeHref={homeHref} />;
}

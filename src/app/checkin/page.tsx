import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import CheckinClient from "./checkin-client";

export default async function CheckinPage() {
  const c = await cookies();
  const role = c.get("role")?.value;
  const identity = c.get("username")?.value || c.get("email")?.value || "";

  // Sales-support must have an identity; otherwise redirect to sign-in.
  if (!identity) {
    redirect("/(auth)/sign-in");
  }

  const homeHref = role === "SUPERVISOR" ? "/supervisor" : "/home";
  return <CheckinClient homeHref={homeHref} email={identity} />;
}

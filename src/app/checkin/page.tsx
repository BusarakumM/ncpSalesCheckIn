import { cookies } from "next/headers";
import CheckinClient from "./checkin-client";

export default async function CheckinPage() {
  const c = await cookies();
  const role = c.get("role")?.value;
  const email = c.get("username")?.value || c.get("email")?.value;
  const homeHref = role === "SUPERVISOR" ? "/supervisor" : "/home";
  return <CheckinClient homeHref={homeHref} email={email || ""} />;
}

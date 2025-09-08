import { cookies } from "next/headers";
import CheckinClient from "./checkin-client";

export default async function CheckinPage() {
  const role = (await cookies()).get("role")?.value;
  const homeHref = role === "SUPERVISOR" ? "/supervisor" : "/home";
  return <CheckinClient homeHref={homeHref} />;
}

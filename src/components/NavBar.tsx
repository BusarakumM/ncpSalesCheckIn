"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/supervisor", label: "Home" },
  { href: "/calendar", label: "Calendar" },
  { href: "/activity", label: "Activity" },
  { href: "/report", label: "Report" },
  { href: "/time-attendance", label: "Time Attendance" },
  { href: "/leave", label: "Leave" },
];

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname.startsWith("/sign-in")) return null; // <-- hide on sign-in

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/sign-in");
  }

  return (
    <nav className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 p-4">
        <span className="text-xl font-bold">NCP Sales Support</span>
        <div className="ml-auto flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={[
                  "rounded px-3 py-2 text-sm transition",
                  active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100",
                ].join(" ")}
              >
                {l.label}
              </Link>
            );
          })}
          <Button variant="outline" onClick={logout}>Logout</Button>
        </div>
      </div>
    </nav>
  );
}

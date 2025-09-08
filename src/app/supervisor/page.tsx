import Link from "next/link";
import { cookies } from "next/headers";
import LogoBadge from "@/components/LogoBadge";
import Image from "next/image";
import {
  CalendarDays,
  Users,
  BarChart3,
  FileText,
  Clock,
  icons
} from "lucide-react";


export default async function SupervisorPage() {
  const name = (await cookies()).get("name")?.value || "Supervisor";
  const email = (await cookies()).get("email")?.value || "supervisor@ncp.co.th";

  const tiles = [
    { href: "/calendar",        title: "Calendar",                 bg: "bg-[#CFE4DD]" , icon: CalendarDays, span2: false},
    { href: "/activity",        title: "Sales Support\nActivity",  bg: "bg-[#E6D8B9]" , icon: Users, span2: false},
    { href: "/report/summary",  title: "Sales Supports\nSummary",  bg: "bg-[#CFE4DD]" , icon: BarChart3, span2: false},
    { href: "/report",          title: "Report",                   bg: "bg-[#E6D8B9]" , icon: FileText, span2: false},
    { href: "/time-attendance", title: "Time Attendance\nReport",  bg: "bg-[#CFE4DD]", icon: Clock, span2: true },
  ];

  return (
    <div className="min-h-screen bg-[#F7F4EA] p-4">
      <div className="mx-auto max-w-md">
        {/* Header bar */}
        <div className="flex items-center gap-3 bg-[#BFD9C8] rounded-xl px-6 py-3">
          {/* Avatar */}
          <Image
            src="/illustrations/avatar.png"
            alt="User avatar"
            width={50}
            height={50}
            className="rounded-full bg-white p-1"
          />

          {/* User info */}
          <div className="flex flex-col">
            <span className="font-semibold">Supervisor</span>
            <span className="text-sm text-gray-700">supervisor@ncp.co.th</span>
          </div>

          {/* Logout button on the right */}
          <form action="/api/auth/logout" method="post" className="ml-auto">
            <button
              type="submit"
              className="rounded-full bg-[#E8CC5C] px-4 py-1 text-gray-900 hover:bg-[#e3c54a] border border-black/20 font-bold"
            >
              Logout
            </button>
          </form>
        </div>

        {/* Tiles */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          {tiles.map(({ href, title, bg, icon: Icon, span2 }) => (
            <Link
              key={href}
              href={href}
              className={`relative rounded-2xl ${bg} p-4 shadow-sm hover:shadow-md transition border border-black/10 ${span2 ? "col-span-2" : ""}`}
            >
              {/* Icon in top-right */}
              <Icon className="absolute top-2 right-2 h-6 w-6 opacity-40" />

              {/* Title centered */}
              <div className="text-lg font-semibold whitespace-pre-line text-left opacity-90">
                {title}
              </div>
            </Link>
          ))}

          {/* Bottom-right logo */}
          <div className="col-span-2 flex justify-end mt-2">
            <LogoBadge size={60} />
          </div>
        </div>
      </div>
    </div>
  );
}

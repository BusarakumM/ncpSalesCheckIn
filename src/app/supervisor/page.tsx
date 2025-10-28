import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LogoBadge from "@/components/LogoBadge";
import Image from "next/image";
import { CalendarDays, Users, BarChart3, FileText, Clock } from "lucide-react";

export default async function SupervisorPage() {
  const c = await cookies();
  const role = c.get("role")?.value;
  if (role !== "SUPERVISOR") {
    redirect("/home");
  }
  const name = c.get("name")?.value || "Supervisor";
  const email = c.get("username")?.value || c.get("email")?.value || "supervisor";

  const tiles = [
    { href: "/calendar",        title: "Calendar",                 bg: "bg-[#CFE4DD]", icon: CalendarDays, span2: false },
    { href: "/activity",        title: "Sales Support\nActivity",  bg: "bg-[#E6D8B9]", icon: Users,        span2: false },
    { href: "/report/summary",  title: "Sales Supports\nSummary",  bg: "bg-[#CFE4DD]", icon: BarChart3,     span2: false },
    { href: "/report",          title: "Report",                   bg: "bg-[#E6D8B9]", icon: FileText,      span2: false },
    { href: "/leave/manage",    title: "Leave\nSubmissions",       bg: "bg-[#CFE4DD]", icon: FileText,      span2: false },
    { href: "/time-attendance", title: "Time Attendance\nReport",  bg: "bg-[#E6D8B9]", icon: Clock,         span2: false },
  ];

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      {/* Fluid container with max width by breakpoint */}
      <div className="mx-auto w-full px-4 sm:px-6 md:px-8 max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl py-4">

        {/* Header bar: stacks on small screens, inline on larger */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-[#BFD9C8] rounded-xl px-4 sm:px-6 py-3">
          {/* Avatar + name/email block */}
          <div className="flex items-center gap-3">
            <Image
              src="/illustrations/avatar.png"
              alt="User avatar"
              width={50}
              height={50}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white p-1"
              priority
            />
            <div className="leading-tight">
              <div className="font-semibold text-base sm:text-lg">{name}</div>
              <div className="text-xs sm:text-sm text-gray-700">{email}</div>
            </div>
          </div>

          {/* Spacer on larger screens */}
          <div className="sm:ml-auto" />

          {/* Logout button */}
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="rounded-full bg-[#E8CC5C] px-4 py-1 text-gray-900 hover:bg-[#e3c54a] border border-black/20 font-semibold text-sm sm:text-base"
            >
              Logout
            </button>
          </form>
        </div>

        {/* Tiles: 1 col on mobile, 2 cols >= sm; responsive padding + icon size */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tiles.map(({ href, title, bg, icon: Icon, span2 }) => (
            <Link
              key={href}
              href={href}
              className={`relative rounded-2xl ${bg} p-4 sm:p-5 md:p-6 shadow-sm hover:shadow-md transition border border-black/10 ${
                span2 ? "sm:col-span-2" : ""
              }`}
            >
              {/* Icon top-right */}
              <Icon className="absolute top-2 right-2 h-5 w-5 sm:h-6 sm:w-6 opacity-40" />

              {/* Title */}
              <div className="text-base sm:text-lg md:text-xl font-semibold whitespace-pre-line opacity-90">
                {title}
              </div>
            </Link>
          ))}

          {/* Logo: aligns right; scales a touch on small screens */}
          <div className="sm:col-span-2 flex justify-end mt-1">
            <LogoBadge size={60} className="scale-[0.95] sm:scale-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { cookies } from "next/headers";
import LogoBadge from "@/components/LogoBadge";
import Image from "next/image";
import { ClipboardCheck, CalendarX, FileText } from "lucide-react";

export default async function SalesSupportHome() {
  const cookieStore = cookies();
  const name = (await cookieStore).get("name")?.value || "Sales Support";
  const email = (await cookieStore).get("email")?.value || "salesupport@ncp.co.th";

  const tiles = [
    { href: "/checkin", title: "Check-in\nCheck-out", bg: "bg-[#BFD9C8]", icon: ClipboardCheck, span2: false },
    { href: "/leave",   title: "Leave",               bg: "bg-[#E6D8B9]", icon: CalendarX,     span2: false },
    { href: "/leave/history", title: "Report Leave History", bg: "bg-[#D9E0DB]", icon: FileText,      span2: false },
    { href: "/report",  title: "Report",              bg: "bg-[#D9E0DB]", icon: FileText,      span2: true },
  ] as const;

  return (
    <div className="min-h-screen bg-[#F7F4EA]">
      {/* Fluid container with responsive max widths */}
      <div className="mx-auto w-full px-4 sm:px-6 md:px-8 py-4 max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl">
        
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-[#BFD9C8] px-4 sm:px-6 py-3">
          {/* Avatar + info */}
          <div className="flex items-center gap-3">
            <Image
              src="/illustrations/avatar.png"
              alt="User avatar"
              width={48}
              height={48}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white p-1"
              priority
            />
            <div className="leading-tight">
              <div className="font-semibold text-base sm:text-lg">{name}</div>
              <div className="text-xs sm:text-sm text-gray-700">{email}</div>
            </div>
          </div>

          {/* Logout aligned right on larger screens */}
          <div className="sm:ml-auto">
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-full bg-[#E8CC5C] px-4 py-1 text-sm sm:text-base font-semibold text-gray-900 hover:bg-[#e3c54a] border border-black/20"
              >
                Logout
              </button>
            </form>
          </div>
        </div>

        {/* Tiles */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tiles.map(({ href, title, bg, icon: Icon, span2 }) => (
            <Link
              key={href}
              href={href}
              className={`relative rounded-2xl ${bg} p-5 sm:p-6 shadow-sm hover:shadow-md transition border border-black/10 ${
                span2 ? "sm:col-span-2" : ""
              }`}
            >
              {/* Icon top-right */}
              <Icon className="absolute right-2 top-2 h-5 w-5 sm:h-6 sm:w-6 opacity-50" />

              {/* Title */}
              <div className="text-base sm:text-lg md:text-xl font-semibold whitespace-pre-line opacity-90">
                {title}
              </div>
            </Link>
          ))}
        </div>

        {/* Bottom-right logo */}
        <div className="mt-3 sm:mt-4 flex justify-end">
          <LogoBadge size={56} className="scale-[0.9] sm:scale-100" />
        </div>
      </div>
    </div>
  );
}

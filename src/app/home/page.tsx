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
    { href: "/leave",   title: "Leave",               bg: "bg-[#E6D8B9]", icon: CalendarX , span2: false},
    { href: "/report",  title: "Report",              bg: "bg-[#D9E0DB]", icon: FileText, span2: true },
  ] as const;

  return (
    <div className="min-h-screen bg-[#F7F4EA] p-4">
      <div className="mx-auto max-w-md">
        {/* Header bar */}
        <div className="flex items-center gap-3 rounded-xl bg-[#BFD9C8] px-6 py-3">
          {/* Avatar */}
          <Image
            src="/illustrations/avatar.png"
            alt="User avatar"
            width={50}
            height={50}
            className="rounded-full bg-white p-1"
          />
          {/* User info */}
          <div className="leading-tight">
            <div className="font-semibold">{name}</div>
            <div className="text-sm text-gray-700">{email}</div>
          </div>
          {/* Logout */}
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
              className={`relative rounded-2xl ${bg} p-6 shadow-sm hover:shadow-md transition border border-black/10 ${span2 ? "col-span-2" : ""}`}
            >
              {/* Icon in top-right */}
              <Icon className="absolute right-2 top-2 h-6 w-6 opacity-40" />

              {/* Title centered */}
              <div className="text-left text-xl font-semibold whitespace-pre-line opacity-90">
                {title}
              </div>
            </Link>
          ))}
        </div>

        {/* Bottom-right logo */}
        <div className="mt-2 flex justify-end">
          <LogoBadge size={60} />
        </div>
      </div>
    </div>
  );
}

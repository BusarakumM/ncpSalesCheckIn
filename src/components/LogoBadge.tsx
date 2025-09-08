import Image from "next/image";
import logo from "@/public/brand/salescheckin.png";

export default function LogoBadge({
  className = "",
  size = 72,
  withText = false,
}: { className?: string; size?: number; withText?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <Image
        src={logo} // ✅ use the imported image here
        alt="NCP Sales Support Check-In"
        width={size}
        height={Math.round(size * 1.52)}
        priority
      />
      {withText && (
        <div className="leading-tight">
          <div className="font-semibold">NCP Sales Support</div>
          <div className="text-sm text-gray-700">Check-In</div>
        </div>
      )}
    </div>
  );
}

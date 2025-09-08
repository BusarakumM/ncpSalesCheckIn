import Image from "next/image";

export default function LogoBadge({
  className = "",
  size = 72,             // tweak per page
  withText = false,      // show the “NCP Sales Support / Check-In” text
}: { className?: string; size?: number; withText?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <Image
        src="/brand/salescheckin.png"
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

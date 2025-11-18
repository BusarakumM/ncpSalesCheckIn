import Image from "next/image";


export default function LogoBadge({
  className = "",
  size = 72,
  withText = false,
  walking = true,
}: { className?: string; size?: number; withText?: boolean; walking?: boolean }) {
  const h = Math.round(size * 1.52);
  const shadowWidth = Math.round(size * 0.7);
  const shadowHeight = Math.max(6, Math.round(size * 0.14));
  return (
    <div className={`inline-flex items-center gap-3 ${walking ? "logo-walking" : ""} ${className}`}>
      <div className="relative inline-block" style={{ width: size, height: h }}>
        <Image
          src="/brand/NCP.png"
          alt="NCP Sales Support Check-In"
          width={size}
          height={h}
          priority
          className="logo-img select-none pointer-events-none"
        />
        {walking && (
          <div
            className="logo-shadow absolute left-1/2"
            style={{ bottom: Math.round(size * 0.04), width: shadowWidth, height: shadowHeight, borderRadius: 9999 }}
          />
        )}
      </div>
      {withText && (
        <div className="leading-tight">
          <div className="font-semibold">NCP Sales Support</div>
          <div className="text-sm text-gray-700">Check-In</div>
        </div>
      )}
    </div>
  );
}

import Image from "next/image";


export default function LogoBadge({
  className = "",
  size = 72,
  withText = false,
  walking = false,
}: { className?: string; size?: number; withText?: boolean; walking?: boolean }) {
  const h = Math.round(size * 1.52);
  const shadowWidth = Math.round(size * 0.7);
  const shadowHeight = Math.max(6, Math.round(size * 0.14));
  const labelFontSize = Math.max(8, Math.round(size * 0.1));
  return (
    <div className={`inline-flex items-center gap-3 ${walking ? "logo-walking" : ""} ${className}`}>
      <div className="relative inline-block overflow-visible" style={{ width: size, height: h }}>
        <Image
          src="/brand/NCP.svg"
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
        <span
          className="absolute font-semibold uppercase text-gray-800 logo-text-label"
          style={{
            fontSize: labelFontSize,
            top: Math.round(size * 0.1),
            left: Math.round(size * 0.02),
            transform: "rotate(-24deg)",
            transformOrigin: "left center",
          }}
        >
          <span className="logo-text-pulse">HOTTA</span>
        </span>
        <span
          className="absolute font-semibold uppercase text-gray-800 logo-text-label"
          style={{
            fontSize: labelFontSize,
            top: Math.round(size * 0.08),
            right: Math.round(size * 0.02),
            transform: "rotate(24deg)",
            transformOrigin: "right center",
          }}
        >
          <span className="logo-text-pulse" style={{ animationDelay: "0.25s" }}>FITNE</span>
        </span>
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

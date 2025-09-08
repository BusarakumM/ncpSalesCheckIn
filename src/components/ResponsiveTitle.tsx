export default function ResponsiveTitle({ children }: { children: React.ReactNode }) {
  // clamp(min, preferred-vw, max) keeps headings pretty on any screen
  return (
    <h1 className="font-extrabold text-center mb-4"
        style={{ fontSize: "clamp(1.5rem, 4vw, 2.25rem)" }}>
      {children}
    </h1>
  );
}

type Props = React.PropsWithChildren<{ className?: string }>;

export default function PageContainer({ children, className = "" }: Props) {
  return (
    <div className={`mx-auto w-full px-4 sm:px-6 md:px-8 ${className}`}>
      {/* Clamp the max width so content never gets too wide on desktop */}
      <div className="mx-auto w-full max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl">
        {children}
      </div>
    </div>
  );
}

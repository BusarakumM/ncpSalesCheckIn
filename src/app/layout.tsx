import type { Metadata } from "next";
import "./globals.css";
import NavBar from "../components/NavBar";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "NCP Sales Support",
  description: "Check-in System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#E8CC5C" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/brand/salescheckin.png" />
      </head>
      <body className="min-h-screen bg-[#F7F4EA] antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}

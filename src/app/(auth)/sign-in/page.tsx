"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import LogoBadge from "@/components/LogoBadge";
import PageContainer from "@/components/PageContainer";
import ResponsiveTitle from "@/components/ResponsiveTitle";

export default function SignInPage() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  async function onLogin() {
    const email = user.includes("@") ? user : "";
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, email, password }),
    });
    if (!res.ok) return alert("Login failed");

    // ✅ Redirect immediately based on role
    const data = await res.json(); // { ok: true, role: "SUPERVISOR" | "AGENT" }
    if (data.role === "SUPERVISOR") {
      router.replace("/supervisor");
    } else {
      router.replace("/home");
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F4EA] flex items-center justify-center px-4">
      <PageContainer className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl">
        {/* Illustration */}
        <div className="flex justify-center mb-4">
          <Image
            src="/illustrations/login.png"
            alt="Sign in illustration"
            width={128}
            height={128}
            className="w-20 sm:w-28 md:w-32 lg:w-36 h-auto"
            priority
          />
        </div>

        {/* Responsive heading (via your helper) */}
        <ResponsiveTitle>Sign In</ResponsiveTitle>

        {/* Mint panel */}
        <Card className="bg-[#BFD9C8] border-none shadow-md">
          <CardContent className="p-5 sm:p-6 md:p-8">
            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-gray-800">User</Label>
                <Input
                  placeholder="supervisor@ncp.co.th"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-gray-800">Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div className="pt-2 sm:pt-3">
                <Button
                  onClick={onLogin}
                  className="w-full rounded-full bg-[#E8CC5C] text-gray-900 hover:bg-[#e3c54a] border border-black/20 text-base sm:text-lg"
                >
                  Login
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bottom-right logo area */}
        <div className="mt-3 sm:mt-4 flex justify-end">
          <LogoBadge size={64} className="sm:scale-100 scale-[0.95]" />
        </div>
      </PageContainer>
    </div>
  );
}

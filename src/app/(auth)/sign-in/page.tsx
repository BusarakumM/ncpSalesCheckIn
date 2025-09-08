"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import LogoBadge from "@/components/LogoBadge";
import loginImg from "@/public/illustrations/log-in.png";

<Image
  src={loginImg}
  alt="Sign in illustration"
  width={128}
  height={128}
  priority
/>


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
    <div className="min-h-screen bg-[#F7F4EA] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Illustration */}
        <div className="flex justify-center mb-4">
          <Image
            src={loginImg}
            alt="Sign in illustration"
            width={128}
            height={128}
            priority
          />
        </div>

        <h1 className="text-3xl font-extrabold text-center mb-4">Sign In</h1>

        {/* Mint panel */}
        <Card className="bg-[#BFD9C8] border-none shadow-none">
          <CardContent className="pt-6">
            <div className="space-y-3">
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

              <div className="pt-4">
                <Button
                  onClick={onLogin}
                  className="w-full rounded-full bg-[#E8CC5C] text-gray-900 hover:bg-[#e3c54a] border border-black/20"
                >
                  Login
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bottom-right logo area (optional) */}
        <div className="mt-3 flex justify-end">
          {/* <Image src="/logo-checkin.svg" alt="logo" width={64} height={64} /> */}
          <LogoBadge size={64} />
        </div>
      </div>
    </div>
  );
}

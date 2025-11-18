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

type LoginResponse = {
  ok: boolean;
  role: "SUPERVISOR" | "AGENT";
  name: string;
  email: string;
};

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"SUPERVISOR" | "AGENT">("AGENT");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  async function onLogin() {
    setError(null);

    if (!email.trim()) {
      setError(mode === "SUPERVISOR" ? "Please enter your company email" : "Please enter your username");
      return;
    }
    // Supervisor path requires @ncp.co.th email domain
    if (mode === "SUPERVISOR") {
      const lower = email.toLowerCase();
      if (!lower.endsWith("@ncp.co.th")) {
        setError("Please use your @ncp.co.th email");
        return;
      }
    }

    try {
      setIsLoading(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "SUPERVISOR"
            ? { mode, user: email, email, password }
            : { mode, user: email, email: "", password }
        ),
      });

      if (!res.ok) {
        const message = await res.text().catch(() => "Login failed");
        throw new Error(message || "Login failed");
      }

      const data = (await res.json()) as LoginResponse;
      if (!data?.ok) throw new Error("Login failed");

      if (data.role === "SUPERVISOR") {
        router.replace("/supervisor");
      } else {
        router.replace("/home");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F4EA] flex items-center justify-center px-4">
      <PageContainer className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl">
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

        <ResponsiveTitle>Sign In</ResponsiveTitle>

        <Card className="bg-[#BFD9C8] border-none shadow-md">
          <CardContent className="p-5 sm:p-6 md:p-8">
            <div className="space-y-4">
              {/* Mode toggle */}
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode("AGENT")}
                  className={`px-3 py-1.5 rounded-full border text-sm ${mode === 'AGENT' ? 'bg-white border-black/30' : 'bg-transparent border-black/20 hover:bg-white/50'}`}
                >
                  Sales Support
                </button>
                <button
                  type="button"
                  onClick={() => setMode("SUPERVISOR")}
                  className={`px-3 py-1.5 rounded-full border text-sm ${mode === 'SUPERVISOR' ? 'bg-white border-black/30' : 'bg-transparent border-black/20 hover:bg-white/50'}`}
                >
                  Supervisor
                </button>
              </div>

              <div className="space-y-1">
                <Label className="text-gray-800">{mode === 'SUPERVISOR' ? 'Email' : 'Username'}</Label>
                <Input
                  placeholder={mode === 'SUPERVISOR' ? 'name@ncp.co.th' : 'username'}
                  type={mode === 'SUPERVISOR' ? 'email' : 'text'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white"
                  autoComplete={mode === 'SUPERVISOR' ? 'email' : 'username'}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-gray-800">Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white"
                  autoComplete="current-password"
                />
              </div>

              {error ? (
                <p className="text-sm text-red-700 bg-white/60 rounded-md px-3 py-2 border border-red-200">
                  {error}
                </p>
              ) : null}

              <div className="pt-2 sm:pt-3">
                <Button
                  onClick={onLogin}
                  className="w-full rounded-full bg-[#E8CC5C] text-gray-900 hover:bg-[#e3c54a] border border-black/20 text-base sm:text-lg"
                  disabled={isLoading}
                >
                  {isLoading ? "Signing in..." : "Login"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-3 sm:mt-4 flex justify-end">
          <LogoBadge size={110} className="sm:scale-100 scale-[0.95]" />
        </div>
      </PageContainer>
    </div>
  );
}

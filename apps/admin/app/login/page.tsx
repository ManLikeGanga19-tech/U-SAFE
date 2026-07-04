"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button, TextField } from "@/components/ui";

export default function LoginPage() {
  const { me, ready, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("admin@u-safe.co.ke");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && me) router.replace("/");
  }, [ready, me, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-ink-900 p-12 text-white lg:flex">
        <div className="font-display text-2xl font-black tracking-tightest">
          U-SAFE<span className="text-signal-500">.</span> ADMIN
        </div>
        <div>
          <h1 className="text-6xl font-black uppercase leading-none">
            Control
            <br />
            <span className="text-signal-500">plane.</span>
          </h1>
          <p className="mt-4 max-w-sm text-ink-300">
            Regulate stock, catalog and everything the storefront shows.
          </p>
        </div>
        <div className="h-3 w-40 bg-hazard-signal" />
      </div>

      <div className="flex items-center justify-center bg-white p-8">
        <form onSubmit={submit} className="w-full max-w-sm">
          <span className="font-display text-xs font-bold uppercase tracking-wideCaps text-royal-600">
            Staff sign in
          </span>
          <h2 className="mt-2 text-3xl font-black uppercase">Welcome back.</h2>

          {error && (
            <div className="mt-5 border-2 border-hivis-400 bg-hivis-50 px-4 py-2.5 text-sm font-medium text-hivis-700">
              {error}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          <Button type="submit" className="mt-6 w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in →"}
          </Button>
          <p className="mt-4 font-mono text-xs text-ink-400">
            Seed admin: admin@u-safe.co.ke
          </p>
        </form>
      </div>
    </div>
  );
}

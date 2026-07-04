"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button, Field, TextField, inputCls } from "@/components/ui";
import { LoginSlider } from "@/components/login-slider";

export default function LoginPage() {
  const { me, ready, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("admin@u-safe.co.ke");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pwId = useId();

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
      {/* Left: framer-motion product slider (hidden on small screens) */}
      <div className="hidden lg:block">
        <LoginSlider />
      </div>

      {/* Right: sign-in form */}
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

            {/* Password with show/hide toggle */}
            <Field label="Password">
              <div className="relative">
                <input
                  id={pwId}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={`${inputCls} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-500 transition-colors hover:text-ink-900 focus:outline-none focus-visible:text-royal-600"
                >
                  {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </Field>
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

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <path
        d="M10.6 6.2A9.8 9.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.4 4.2M6.5 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4-.9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
      <path
        d="M9.5 9.6a3 3 0 0 0 4.2 4.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="square"
      />
    </svg>
  );
}

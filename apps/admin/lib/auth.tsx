"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, clearToken, getToken, Me, setToken } from "./api";

interface AuthState {
  me: Me | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = getToken();
    if (!t) {
      setReady(true);
      return;
    }
    api
      .me()
      .then(setMe)
      .catch(() => clearToken())
      .finally(() => setReady(true));
  }, []);

  async function signIn(email: string, password: string) {
    const token = await api.login(email, password);
    setToken(token);
    const profile = await api.me();
    setMe(profile);
  }

  function signOut() {
    clearToken();
    setMe(null);
  }

  return <Ctx.Provider value={{ me, ready, signIn, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const TOKEN_KEY = "usafe_cart_token";

export interface CartLine {
  id: string;
  variant_id: string;
  sku: string;
  product_name: string;
  product_slug: string;
  variant_name: string | null;
  image_url: string | null;
  unit_price_kes: number;
  quantity: number;
  line_total_kes: number;
  available: number;
}
export interface Cart {
  token: string;
  items: CartLine[];
  item_count: number;
  subtotal_kes: number;
}

const EMPTY: Cart = { token: "", items: [], item_count: 0, subtotal_kes: 0 };

interface CartCtx {
  cart: Cart;
  loading: boolean;
  addItem: (variantId: string, quantity: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearLocal: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<CartCtx | null>(null);

function getToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
}

async function call(path: string, method: string, body?: unknown): Promise<Cart> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["X-Cart-Token"] = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API}/api/v1${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { detail?: string }).detail || "Cart error");
  }
  const cart = (await res.json()) as Cart;
  if (cart.token) localStorage.setItem(TOKEN_KEY, cart.token);
  return cart;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>(EMPTY);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      if (!getToken()) {
        setCart(EMPTY);
        return;
      }
      setCart(await call("/cart", "GET"));
    } catch {
      setCart(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(async (variantId: string, quantity: number) => {
    setCart(await call("/cart/items", "POST", { variant_id: variantId, quantity }));
  }, []);
  const updateItem = useCallback(async (itemId: string, quantity: number) => {
    setCart(await call(`/cart/items/${itemId}`, "PATCH", { quantity }));
  }, []);
  const removeItem = useCallback(async (itemId: string) => {
    setCart(await call(`/cart/items/${itemId}`, "DELETE"));
  }, []);
  const clearLocal = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setCart(EMPTY);
  }, []);

  return (
    <Ctx.Provider value={{ cart, loading, addItem, updateItem, removeItem, clearLocal, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart(): CartCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export const formatKES = (n: number): string =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(n);

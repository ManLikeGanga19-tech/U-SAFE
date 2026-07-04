// API client. Server components use the in-network URL; the browser uses the
// public URL. Both hit the FastAPI backend.

const API_INTERNAL = process.env.API_INTERNAL_URL || "http://api:8000";
const API_PUBLIC =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

function base(): string {
  return typeof window === "undefined" ? API_INTERNAL : API_PUBLIC;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${base()}/api/v1${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ContentBlock {
  id: string;
  key: string;
  kind: string;
  title: string | null;
  body: string | null;
  data: Record<string, string>;
  is_active: boolean;
  sort_order: number;
}

// ── Types (mirror the API schemas) ──
export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
}

export interface Variant {
  id: string;
  sku: string;
  name: string | null;
  options: Record<string, unknown>;
  price_kes: number;
  compare_at_kes: number | null;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  summary: string | null;
  description: string | null;
  status: string;
  is_featured: boolean;
  images: { url: string; alt?: string }[];
  standards: string[];
  attributes: Record<string, string>;
  brand: Brand | null;
  category: Category | null;
  variants: Variant[];
}

export const formatKES = (n: number): string =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(n);

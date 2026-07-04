// Typed admin API client. Talks to the FastAPI backend with the stored JWT.
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const V1 = `${API}/api/v1`;
export const TOKEN_KEY = "usafe_admin_token";

export function getToken(): string | null {
  return typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${V1}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (data as { detail?: string }).detail || res.statusText;
    throw new ApiError(res.status, detail);
  }
  return data as T;
}

// ── Types ──
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}
export type ProductStatus = "draft" | "published" | "archived";

export interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

export interface DashboardStats {
  products: { total: number; published: number; draft: number };
  catalog: { categories: number; brands: number };
  orders: { total: number; by_status: Record<string, number> };
  quotes: { total: number; by_status: Record<string, number> };
  revenue: { total_kes: number; orders: number; avg_order_kes: number };
  revenue_series: { date: string; orders: number; revenue_kes: number }[];
  top_products: { name: string; qty: number; revenue_kes: number }[];
  low_stock_count: number;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
}
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
  product_count: number;
}
export interface Variant {
  id: string;
  sku: string;
  name: string | null;
  options: Record<string, unknown>;
  price_kes: number;
  compare_at_kes: number | null;
  barcode: string | null;
  is_active: boolean;
  quantity_on_hand: number;
  reorder_level: number;
}
export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  status: ProductStatus;
  is_featured: boolean;
  brand_name: string | null;
  category_name: string | null;
  variant_count: number;
  total_stock: number;
  updated_at: string;
}
export interface Product {
  id: string;
  name: string;
  slug: string;
  summary: string | null;
  description: string | null;
  brand_id: string | null;
  category_id: string | null;
  status: ProductStatus;
  is_featured: boolean;
  images: { url: string; alt?: string }[];
  standards: string[];
  tags: string[];
  attributes: Record<string, string>;
  variants: Variant[];
  created_at: string;
  updated_at: string;
}
export interface StockMovement {
  id: string;
  variant_id: string;
  delta: number;
  reason: string;
  reference: string | null;
  note: string | null;
  created_at: string;
}
export interface Me {
  email: string;
  full_name: string | null;
  role: string;
}
export type QuoteStatus = "requested" | "priced" | "accepted" | "expired" | "cancelled";
export interface QuoteListItem {
  id: string;
  number: string;
  status: QuoteStatus;
  company_name: string | null;
  contact_name: string | null;
  item_count: number;
  total_kes: number | null;
  created_at: string;
}
export interface QuoteLine {
  id: string;
  description: string;
  sku: string | null;
  quantity: number;
  unit_price_kes: number | null;
  line_total_kes: number | null;
}
export interface Quote {
  id: string;
  number: string;
  status: QuoteStatus;
  company_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  message: string | null;
  items: QuoteLine[];
  total_kes: number | null;
  pdf_url: string | null;
  created_at: string;
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
export type OrderStatus = "pending" | "paid" | "processing" | "fulfilled" | "cancelled" | "refunded";
export interface OrderListItem {
  id: string;
  number: string;
  status: OrderStatus;
  total_kes: number;
  contact_name: string | null;
  payment_status: string | null;
  item_count: number;
  created_at: string;
}
export interface OrderLine {
  sku: string;
  name: string;
  unit_price_kes: number;
  quantity: number;
  line_total_kes: number;
}
export interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  subtotal_kes: number;
  total_kes: number;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  shipping_address: Record<string, string>;
  items: OrderLine[];
  payment: {
    provider: string;
    status: string;
    amount_kes: number;
    checkout_request_id: string | null;
    mpesa_receipt: string | null;
  } | null;
  created_at: string;
}

// ── API surface ──
export const api = {
  async login(email: string, password: string): Promise<string> {
    const body = new URLSearchParams({ username: email, password });
    const res = await fetch(`${V1}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, (data as { detail?: string }).detail || "Login failed");
    return (data as { access_token: string }).access_token;
  },
  me: () => req<Me>("GET", "/auth/me"),

  products: {
    list: (q: URLSearchParams) => req<Page<ProductListItem>>("GET", `/admin/products?${q}`),
    get: (id: string) => req<Product>("GET", `/admin/products/${id}`),
    create: (body: unknown) => req<Product>("POST", "/admin/products", body),
    update: (id: string, body: unknown) => req<Product>("PATCH", `/admin/products/${id}`, body),
    remove: (id: string) => req<void>("DELETE", `/admin/products/${id}`),
    addVariant: (pid: string, body: unknown) => req<Variant>("POST", `/admin/products/${pid}/variants`, body),
    updateVariant: (pid: string, vid: string, body: unknown) =>
      req<Variant>("PATCH", `/admin/products/${pid}/variants/${vid}`, body),
    removeVariant: (pid: string, vid: string) =>
      req<void>("DELETE", `/admin/products/${pid}/variants/${vid}`),
    importCsv: async (file: File): Promise<ImportResult> => {
      const fd = new FormData();
      fd.append("file", file);
      const token = getToken();
      const res = await fetch(`${V1}/admin/products/import`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new ApiError(res.status, (data as { detail?: string }).detail || "Import failed");
      return data as ImportResult;
    },
  },
  categories: {
    list: () => req<Category[]>("GET", "/admin/categories"),
    create: (body: unknown) => req<Category>("POST", "/admin/categories", body),
    update: (id: string, body: unknown) => req<Category>("PATCH", `/admin/categories/${id}`, body),
    remove: (id: string) => req<void>("DELETE", `/admin/categories/${id}`),
  },
  brands: {
    list: () => req<Brand[]>("GET", "/admin/brands"),
    create: (body: unknown) => req<Brand>("POST", "/admin/brands", body),
    update: (id: string, body: unknown) => req<Brand>("PATCH", `/admin/brands/${id}`, body),
    remove: (id: string) => req<void>("DELETE", `/admin/brands/${id}`),
  },
  stats: {
    get: () => req<DashboardStats>("GET", "/admin/stats"),
  },
  inventory: {
    adjust: (vid: string, body: unknown) => req<Variant>("POST", `/admin/inventory/variants/${vid}/adjust`, body),
    movements: (q: URLSearchParams) => req<Page<StockMovement>>("GET", `/admin/inventory/movements?${q}`),
    lowStock: () => req<Array<{ variant_id: string; sku: string; product: string; on_hand: number; reorder_level: number }>>("GET", "/admin/inventory/low-stock"),
  },
  orders: {
    list: (q: URLSearchParams) => req<Page<OrderListItem>>("GET", `/admin/orders?${q}`),
    get: (id: string) => req<Order>("GET", `/admin/orders/${id}`),
    setStatus: (id: string, status: OrderStatus) =>
      req<Order>("PATCH", `/admin/orders/${id}`, { status }),
  },
  quotes: {
    list: (q: URLSearchParams) => req<Page<QuoteListItem>>("GET", `/admin/quotes?${q}`),
    get: (id: string) => req<Quote>("GET", `/admin/quotes/${id}`),
    price: (id: string, lines: { item_id: string; unit_price_kes: number }[]) =>
      req<Quote>("POST", `/admin/quotes/${id}/price`, { lines }),
    generatePdf: (id: string) => req<Quote>("POST", `/admin/quotes/${id}/pdf`),
    setStatus: (id: string, status: QuoteStatus) =>
      req<Quote>("PATCH", `/admin/quotes/${id}`, { status }),
  },
  content: {
    list: () => req<ContentBlock[]>("GET", "/admin/content"),
    create: (body: unknown) => req<ContentBlock>("POST", "/admin/content", body),
    update: (id: string, body: unknown) => req<ContentBlock>("PATCH", `/admin/content/${id}`, body),
    remove: (id: string) => req<void>("DELETE", `/admin/content/${id}`),
  },
  async uploadImage(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const token = getToken();
    const res = await fetch(`${V1}/admin/media/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, (data as { detail?: string }).detail || "Upload failed");
    return (data as { url: string }).url;
  },
};

export const formatKES = (n: number): string =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

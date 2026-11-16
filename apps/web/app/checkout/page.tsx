"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatKES, useCart } from "@/lib/cart";
import {
  apiErrorMessage,
  forgetDetails,
  Fulfilment,
  isSafaricomNumber,
  KRA_PIN_RE,
  loadSavedDetails,
  PaymentMethod,
  saveDetails,
  useCheckoutOptions,
  vatFor,
} from "@/lib/checkout";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

type FieldKey =
  | "name"
  | "email"
  | "phone"
  | "city"
  | "companyName"
  | "kraPin"
  | "mpesaPhone";

const field =
  "w-full border-2 border-ink-900 bg-white px-3 py-2.5 text-sm focus:outline-none focus:shadow-focus aria-[invalid=true]:border-hivis-600";
const labelCls = "mb-1.5 block font-display text-xs font-bold uppercase tracking-wideCaps text-ink-700";

export default function CheckoutPage() {
  const { cart, loading, refresh } = useCart();
  const router = useRouter();
  const options = useCheckoutOptions();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    address: "",
    notes: "",
    companyName: "",
    kraPin: "",
    poNumber: "",
    mpesaPhone: "",
  });
  const [fulfilment, setFulfilment] = useState<Fulfilment>("delivery");
  const [method, setMethod] = useState<PaymentMethod>("mpesa_stk");
  const [isCompany, setIsCompany] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Prefill from this device.
  useEffect(() => {
    const saved = loadSavedDetails();
    setForm((f) => ({
      ...f,
      name: saved.name || "",
      email: saved.email || "",
      phone: saved.phone || "",
      city: saved.city || "",
      address: saved.address || "",
      companyName: saved.companyName || "",
      kraPin: saved.kraPin || "",
    }));
    if (saved.companyName) setIsCompany(true);
  }, []);

  // If the chosen method isn't offered (config changed), fall back to STK.
  useEffect(() => {
    if (!options.payment_methods.some((m) => m.id === method)) setMethod("mpesa_stk");
  }, [options, method]);

  useEffect(() => {
    // Send shoppers with an empty cart back — but NOT right after they placed an
    // order (checkout consumes the cart), otherwise we'd race the /order redirect.
    if (!loading && cart.items.length === 0 && !placed) router.replace("/cart");
  }, [loading, cart.items.length, router, placed]);

  const subtotal = cart.subtotal_kes;
  const vat = vatFor(subtotal, options.vat_rate);
  const total = subtotal + vat;
  const vatPct = Math.round(options.vat_rate * 100);
  const shortStock = cart.items.filter((l) => l.quantity > l.available);
  const stk = method === "mpesa_stk";

  const set = (k: keyof typeof form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (k in errors) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  function validate(): Partial<Record<FieldKey, string>> {
    const e: Partial<Record<FieldKey, string>> = {};
    if (!form.name.trim()) e.name = "Enter your full name";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = "Enter a valid email address";
    if (form.phone.replace(/\D/g, "").length < 9) e.phone = "Enter a phone number we can call";
    if (fulfilment === "delivery" && !form.city.trim()) e.city = "Enter the town or city";
    if (isCompany) {
      if (form.companyName.trim().length < 2) e.companyName = "Enter the company name";
      const pin = form.kraPin.trim().toUpperCase().replace(/\s/g, "");
      if (pin && !KRA_PIN_RE.test(pin)) e.kraPin = "KRA PIN looks like P051234567X";
    }
    if (stk) {
      const p = form.mpesaPhone || form.phone;
      if (!isSafaricomNumber(p)) e.mpesaPhone = "Enter a Safaricom number, e.g. 0712 345 678";
    }
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setServerError(null);
    const e = validate();
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }

    setBusy(true);
    try {
      const token = localStorage.getItem("usafe_cart_token");
      const res = await fetch(`${API}/api/v1/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Cart-Token": token || "" },
        body: JSON.stringify({
          contact: { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() },
          fulfilment,
          shipping_address:
            fulfilment === "delivery"
              ? { city: form.city, address: form.address, notes: form.notes }
              : { notes: form.notes },
          payment_method: method,
          mpesa_phone: stk ? form.mpesaPhone || form.phone : null,
          company: isCompany
            ? {
                name: form.companyName.trim(),
                kra_pin: form.kraPin.trim() || null,
                po_number: form.poNumber.trim() || null,
              }
            : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(apiErrorMessage(data, "Checkout failed. Please try again."));

      if (remember) {
        saveDetails({
          name: form.name,
          email: form.email,
          phone: form.phone,
          city: form.city,
          address: form.address,
          companyName: isCompany ? form.companyName : "",
          kraPin: isCompany ? form.kraPin : "",
        });
      } else {
        forgetDetails();
      }
      setPlaced(true); // suppress the empty-cart guard before the cart refreshes
      router.replace(`/order/${data.order_number}`);
      refresh(); // update header count in the background
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Checkout failed");
      window.scrollTo({ top: 0, behavior: "smooth" });
      setBusy(false);
    }
  }

  const submitLabel = useMemo(() => {
    if (busy) return stk ? "Sending M-Pesa prompt…" : "Placing order…";
    return stk ? `Pay ${formatKES(total)} with M-Pesa →` : "Place order →";
  }, [busy, stk, total]);

  if (loading || (cart.items.length === 0 && !placed)) {
    return <div className="shell py-16 font-mono text-sm text-ink-400">Loading checkout…</div>;
  }

  return (
    <div className="shell py-10">
      <div className="border-b-2 border-ink-900 pb-4">
        <ol className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase text-ink-400">
          <li>
            <Link href="/cart" className="hover:text-royal-600">Cart</Link>
          </li>
          <li aria-hidden>→</li>
          <li className="font-bold text-ink-900" aria-current="step">Details &amp; payment</li>
          <li aria-hidden>→</li>
          <li>Confirmation</li>
        </ol>
        <h1 className="mt-2 text-4xl font-black uppercase md:text-5xl">Checkout</h1>
      </div>

      {/* Compact total for small screens; the full summary is further down. */}
      <div className="mt-4 flex items-center justify-between border-2 border-ink-900 bg-ink-900 px-4 py-3 text-white lg:hidden">
        <span className="font-mono text-xs uppercase">
          {cart.item_count} item{cart.item_count === 1 ? "" : "s"} · incl. VAT
        </span>
        <span className="font-display text-xl font-black">{formatKES(total)}</span>
      </div>

      <form ref={formRef} onSubmit={submit} noValidate className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {serverError && (
            <div role="alert" className="border-2 border-hivis-500 bg-hivis-50 px-4 py-3 text-sm font-medium text-hivis-700">
              {serverError}
            </div>
          )}
          {shortStock.length > 0 && (
            <div role="alert" className="border-2 border-hivis-500 bg-hivis-50 px-4 py-3 text-sm text-hivis-700">
              Some items are low on stock ({shortStock.map((l) => `${l.product_name}: ${l.available} left`).join(", ")}).{" "}
              <Link href="/cart" className="font-bold underline">Update your cart</Link> before checking out.
            </div>
          )}

          {/* 1. Contact */}
          <Section n={1} title="Your details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name" error={errors.name} className="sm:col-span-2">
                <input name="name" autoComplete="name" className={field} value={form.name}
                  aria-invalid={!!errors.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Email" error={errors.email} hint="For your order confirmation">
                <input name="email" type="email" autoComplete="email" className={field} value={form.email}
                  aria-invalid={!!errors.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label="Phone" error={errors.phone} hint="We call to confirm your order">
                <input name="phone" type="tel" autoComplete="tel" inputMode="tel" className={field}
                  value={form.phone} placeholder="07XX XXX XXX" aria-invalid={!!errors.phone}
                  onChange={(e) => set("phone", e.target.value)} />
              </Field>
            </div>

            <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm font-semibold">
              <input type="checkbox" className="h-4 w-4 accent-royal-600" checked={isCompany}
                onChange={(e) => setIsCompany(e.target.checked)} />
              Buying for a company? Add details for your invoice
            </label>
            {isCompany && (
              <div className="mt-4 grid grid-cols-1 gap-4 border-l-4 border-royal-600 pl-4 sm:grid-cols-2">
                <Field label="Company name" error={errors.companyName} className="sm:col-span-2">
                  <input name="companyName" autoComplete="organization" className={field}
                    value={form.companyName} aria-invalid={!!errors.companyName}
                    onChange={(e) => set("companyName", e.target.value)} />
                </Field>
                <Field label="KRA PIN (optional)" error={errors.kraPin}>
                  <input name="kraPin" className={`${field} uppercase`} value={form.kraPin}
                    placeholder="P051234567X" maxLength={11} aria-invalid={!!errors.kraPin}
                    onChange={(e) => set("kraPin", e.target.value)} />
                </Field>
                <Field label="PO number (optional)">
                  <input name="poNumber" className={field} value={form.poNumber}
                    onChange={(e) => set("poNumber", e.target.value)} />
                </Field>
              </div>
            )}
          </Section>

          {/* 2. Fulfilment */}
          <Section n={2} title="Delivery or pickup">
            <div role="radiogroup" aria-label="Delivery or pickup" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Choice
                checked={fulfilment === "delivery"}
                onSelect={() => setFulfilment("delivery")}
                title="Deliver to me"
                note="Delivery cost is confirmed by phone before dispatch"
              />
              <Choice
                checked={fulfilment === "pickup"}
                onSelect={() => setFulfilment("pickup")}
                title="Pick up — free"
                note={options.pickup_address + (options.pickup_hours ? ` · ${options.pickup_hours}` : "")}
              />
            </div>

            {fulfilment === "delivery" ? (
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Town / city" error={errors.city}>
                  <input name="city" autoComplete="address-level2" className={field} value={form.city}
                    aria-invalid={!!errors.city} onChange={(e) => set("city", e.target.value)} />
                </Field>
                <Field label="Street / building">
                  <input name="address" autoComplete="street-address" className={field} value={form.address}
                    onChange={(e) => set("address", e.target.value)} />
                </Field>
                <Field label="Delivery notes (optional)" className="sm:col-span-2">
                  <input name="notes" className={field} value={form.notes}
                    placeholder="Gate, landmark, site contact…" onChange={(e) => set("notes", e.target.value)} />
                </Field>
                <p className="sm:col-span-2 font-mono text-xs text-ink-500">
                  Delivery isn&apos;t included in your total. We&apos;ll call you with the cost for your location
                  before dispatching. You can still choose pickup.
                </p>
              </div>
            ) : (
              <div className="mt-5">
                <Field label="Notes (optional)">
                  <input name="notes" className={field} value={form.notes}
                    placeholder="Who will collect, preferred day…" onChange={(e) => set("notes", e.target.value)} />
                </Field>
                <p className="mt-2 font-mono text-xs text-ink-500">
                  We&apos;ll call you when your order is ready to collect.
                </p>
              </div>
            )}
          </Section>

          {/* 3. Payment */}
          <Section n={3} title="Payment">
            <div role="radiogroup" aria-label="Payment method" className="space-y-3">
              {options.payment_methods.map((m) => (
                <Choice
                  key={m.id}
                  checked={method === m.id}
                  onSelect={() => setMethod(m.id)}
                  title={m.label}
                  note={m.description}
                  badge={m.id === "mpesa_stk" ? "Fastest" : undefined}
                />
              ))}
            </div>

            {stk ? (
              <div className="mt-5">
                <Field label="M-Pesa number" error={errors.mpesaPhone}
                  hint={form.mpesaPhone ? undefined : "Leave blank to use your phone number above"}>
                  <input name="mpesaPhone" type="tel" inputMode="tel" className={field}
                    value={form.mpesaPhone} placeholder={form.phone || "07XX XXX XXX"}
                    aria-invalid={!!errors.mpesaPhone} onChange={(e) => set("mpesaPhone", e.target.value)} />
                </Field>
              </div>
            ) : (
              <p className="mt-4 border-2 border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-700">
                After you place the order you&apos;ll see the {method === "mpesa_paybill" ? "Paybill" : "bank"} details
                and your order number to use as the reference. We hold your items for{" "}
                {options.manual_hold_days} day{options.manual_hold_days === 1 ? "" : "s"} while we wait for payment.
              </p>
            )}
          </Section>
        </div>

        {/* Summary */}
        <aside className="h-fit border-2 border-ink-900 bg-white lg:sticky lg:top-6">
          <div className="border-b-2 border-ink-900 p-5">
            <h2 className="font-display text-lg font-black uppercase">Order summary</h2>
          </div>
          <ul className="max-h-72 divide-y divide-ink-100 overflow-y-auto">
            {cart.items.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <div className="relative h-12 w-12 shrink-0 border-2 border-ink-900 bg-ink-50">
                  {l.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.image_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : null}
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-[1.25rem] items-center justify-center bg-ink-900 px-1 font-mono text-[10px] text-white">
                    {l.quantity}
                  </span>
                </div>
                <span className="min-w-0 flex-1 leading-tight text-ink-700">
                  {l.product_name}
                  {l.variant_name && <span className="block font-mono text-[11px] text-ink-400">{l.variant_name}</span>}
                </span>
                <span className="shrink-0 font-mono">{formatKES(l.line_total_kes)}</span>
              </li>
            ))}
          </ul>
          <dl className="space-y-2 border-t-2 border-ink-900 p-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-500">Subtotal (excl. VAT)</dt>
              <dd className="font-mono">{formatKES(subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">VAT {vatPct}%</dt>
              <dd className="font-mono">{formatKES(vat)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">{fulfilment === "pickup" ? "Pickup" : "Delivery"}</dt>
              <dd className="text-right font-mono">{fulfilment === "pickup" ? "Free" : "Quoted by phone"}</dd>
            </div>
          </dl>
          <div className="border-t-2 border-ink-900 bg-ink-900 p-5 text-white">
            <div className="flex items-center justify-between">
              <span className="font-display uppercase tracking-wideCaps">Total</span>
              <span className="font-display text-2xl font-black">{formatKES(total)}</span>
            </div>
          </div>
          <div className="space-y-3 p-5">
            <button type="submit" disabled={busy || shortStock.length > 0} className="btn-signal w-full justify-center disabled:opacity-60">
              {submitLabel}
            </button>
            <label className="flex cursor-pointer items-center gap-2 font-mono text-xs text-ink-500">
              <input type="checkbox" className="accent-royal-600" checked={remember}
                onChange={(e) => setRemember(e.target.checked)} />
              Remember my details on this device
            </label>
            <Link href="/cart" className="block text-center font-mono text-xs text-royal-600 hover:underline">
              ← Back to cart
            </Link>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-2 border-ink-900 bg-white p-5 sm:p-6">
      <h2 className="mb-5 flex items-center gap-3 font-display text-lg font-black uppercase">
        <span className="flex h-7 w-7 items-center justify-center bg-ink-900 font-mono text-sm text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  hint,
  className = "",
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className={labelCls}>{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-hivis-700">{error}</span>
      ) : hint ? (
        <span className="mt-1 block font-mono text-[11px] text-ink-400">{hint}</span>
      ) : null}
    </label>
  );
}

function Choice({
  checked,
  onSelect,
  title,
  note,
  badge,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  note: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={`flex w-full items-start gap-3 border-2 p-4 text-left transition-colors focus:outline-none focus:shadow-focus ${
        checked ? "border-ink-900 bg-signal-50" : "border-ink-200 bg-white hover:border-ink-900"
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-ink-900 ${
          checked ? "bg-ink-900" : "bg-white"
        }`}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-signal-500" />}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 font-display text-sm font-bold uppercase">
          {title}
          {badge && <span className="bg-signal-500 px-1.5 py-0.5 font-mono text-[10px] text-ink-900">{badge}</span>}
        </span>
        <span className="mt-1 block text-xs text-ink-500">{note}</span>
      </span>
    </button>
  );
}

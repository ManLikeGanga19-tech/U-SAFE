"use client";

// Small shared UI primitives for the admin (no border-radius, hard edges).
import Link from "next/link";
import { cloneElement, isValidElement, useId } from "react";

export function Button({
  children,
  variant = "signal",
  className = "",
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "signal" | "ghost" | "danger";
}) {
  const styles = {
    signal: "bg-signal-500 text-ink-900 border-ink-900 hover:bg-signal-400",
    ghost: "bg-white text-ink-900 border-ink-900 hover:bg-ink-900 hover:text-white",
    danger: "bg-white text-hivis-700 border-hivis-500 hover:bg-hivis-500 hover:text-white",
  }[variant];
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 border-2 px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wideCaps transition-colors disabled:opacity-50 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  const autoId = useId();
  // Programmatically associate the label with its control (a11y): reuse the
  // control's own id if present, otherwise inject a generated one.
  let controlId: string | undefined;
  let control = children;
  if (isValidElement(children)) {
    const el = children as React.ReactElement<{ id?: string }>;
    controlId = el.props.id ?? autoId;
    control = cloneElement(el, { id: controlId });
  }
  return (
    <div className="block">
      <label
        htmlFor={controlId}
        className="mb-1.5 block font-display text-xs font-bold uppercase tracking-wideCaps text-ink-700"
      >
        {label}
      </label>
      {control}
      {hint && <span className="mt-1 block font-mono text-xs text-ink-400">{hint}</span>}
    </div>
  );
}

export const inputCls =
  "w-full border-2 border-ink-900 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:shadow-focus";

function Labelled({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block font-display text-xs font-bold uppercase tracking-wideCaps text-ink-700"
      >
        {label}
      </label>
      {children}
      {hint && <span className="mt-1 block font-mono text-xs text-ink-400">{hint}</span>}
    </div>
  );
}

// Combined label + control components. The native element carries a literal
// aria-label (accessible name) AND an id associated with the label — so both
// static a11y linters and screen readers are satisfied. Prefer these over a
// bare <input>/<select>/<textarea> anywhere in the admin.
export function TextField({
  label,
  hint,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <Labelled label={label} hint={hint} htmlFor={id}>
      <input id={id} aria-label={label} className={`${inputCls} ${className}`} {...props} />
    </Labelled>
  );
}

export function TextareaField({
  label,
  hint,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <Labelled label={label} hint={hint} htmlFor={id}>
      <textarea id={id} aria-label={label} className={`${inputCls} ${className}`} {...props} />
    </Labelled>
  );
}

export function SelectField({
  label,
  hint,
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <Labelled label={label} hint={hint} htmlFor={id}>
      <select id={id} aria-label={label} className={`${inputCls} ${className}`} {...props}>
        {children}
      </select>
    </Labelled>
  );
}

export function PageHead({
  title,
  eyebrow,
  action,
}: {
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between border-b-2 border-ink-900 pb-4">
      <div>
        {eyebrow && (
          <span className="font-display text-xs font-bold uppercase tracking-wideCaps text-royal-600">
            {eyebrow}
          </span>
        )}
        <h1 className="mt-1 text-3xl font-black uppercase text-ink-900">{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: "bg-signal-500 text-ink-900",
    draft: "bg-ink-200 text-ink-700",
    archived: "bg-ink-900 text-white",
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wideCaps ${
        map[status] || "bg-ink-200 text-ink-700"
      }`}
    >
      {status}
    </span>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink-900/60"
        onClick={busy ? undefined : onCancel}
        aria-hidden
      />
      <div className="relative w-full max-w-md border-2 border-ink-900 bg-white shadow-hard">
        <div className="h-2 bg-hazard" />
        <div className="p-6">
          <h2 className="text-2xl font-black uppercase text-ink-900">{title}</h2>
          <p className="mt-3 text-sm text-ink-600">{message}</p>
          <div className="mt-6 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={onConfirm} disabled={busy}>
              {busy ? "Deleting…" : confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Toast({ msg, kind = "ok" }: { msg: string; kind?: "ok" | "err" }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 border-2 px-5 py-3 font-display text-sm font-bold uppercase tracking-wideCaps shadow-hard ${
        kind === "ok"
          ? "border-ink-900 bg-signal-500 text-ink-900"
          : "border-hivis-500 bg-white text-hivis-700"
      }`}
    >
      {msg}
    </div>
  );
}

export { Link };

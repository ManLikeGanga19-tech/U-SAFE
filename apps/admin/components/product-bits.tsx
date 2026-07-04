"use client";

import { useEffect, useState } from "react";
import { api, Brand, Category } from "@/lib/api";

export function useTaxonomy() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  useEffect(() => {
    api.brands.list().then(setBrands).catch(() => {});
    api.categories.list().then(setCategories).catch(() => {});
  }, []);
  return { brands, categories };
}

export interface Img {
  url: string;
  alt?: string;
}

export function ImageUploader({
  images,
  onChange,
}: {
  images: Img[];
  onChange: (imgs: Img[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      const url = await api.uploadImage(file);
      onChange([...images, { url }]);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Upload failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {images.map((im, i) => (
          <div key={im.url} className="relative h-24 w-24 border-2 border-ink-900 bg-ink-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(images.filter((_, idx) => idx !== i))}
              className="absolute -right-2 -top-2 h-6 w-6 border-2 border-ink-900 bg-hivis-400 font-bold text-ink-900"
              aria-label="Remove image"
            >
              ×
            </button>
          </div>
        ))}
        <label className="flex h-24 w-24 cursor-pointer items-center justify-center border-2 border-dashed border-ink-400 bg-white text-center font-display text-xs font-bold uppercase tracking-wideCaps text-ink-500 hover:border-ink-900 hover:text-ink-900">
          {busy ? "…" : "+ Upload"}
          <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={busy} />
        </label>
      </div>
      {err && <p className="mt-2 font-mono text-xs text-hivis-700">{err}</p>}
    </div>
  );
}

export function StandardsInput({
  value,
  onChange,
  placeholder = "EN 388, EN 166…",
  ariaLabel = "Comma-separated values",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(value.join(", "));
  return (
    <input
      aria-label={ariaLabel}
      className="w-full border-2 border-ink-900 bg-white px-3 py-2.5 font-mono text-sm focus:outline-none focus:shadow-focus"
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        onChange(
          e.target.value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        );
      }}
    />
  );
}

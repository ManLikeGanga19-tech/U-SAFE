"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { Button, Field, PageHead, SelectField, TextField, TextareaField } from "@/components/ui";
import { ImageUploader, Img, StandardsInput, useTaxonomy } from "@/components/product-bits";

interface DraftVariant {
  name: string;
  price_kes: string;
  initial_stock: string;
  reorder_level: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const { brands, categories } = useTaxonomy();

  const [name, setName] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("draft");
  const [featured, setFeatured] = useState(false);
  const [standards, setStandards] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<Img[]>([]);
  const [variants, setVariants] = useState<DraftVariant[]>([
    { name: "Standard", price_kes: "", initial_stock: "0", reorder_level: "10" },
  ]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setV(i: number, patch: Partial<DraftVariant>) {
    setVariants((vs) => vs.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const product = await api.products.create({
        name,
        summary: summary || null,
        description: description || null,
        brand_id: brandId || null,
        category_id: categoryId || null,
        status,
        is_featured: featured,
        standards,
        tags,
        images,
        variants: variants
          .filter((v) => v.price_kes !== "")
          .map((v) => ({
            name: v.name || null,
            price_kes: Number(v.price_kes),
            initial_stock: Number(v.initial_stock || 0),
            reorder_level: Number(v.reorder_level || 0),
          })),
      });
      router.replace(`/products/${product.id}`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to create");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <PageHead
        eyebrow="Catalog"
        title="New product"
        action={
          <div className="flex gap-3">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Create product"}
            </Button>
          </div>
        }
      />

      {err && (
        <div className="border-2 border-hivis-500 bg-hivis-50 px-4 py-2.5 text-sm font-medium text-hivis-700">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main */}
        <div className="space-y-5 border-2 border-ink-900 bg-white p-6">
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField label="Summary" hint="Short line shown on cards & PDP" value={summary} onChange={(e) => setSummary(e.target.value)} />
          <TextareaField label="Description" className="min-h-[120px]" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Field label="Standards (comma separated)">
            <StandardsInput value={standards} onChange={setStandards} />
          </Field>
          <Field label="Tags (comma separated)" hint="e.g. kit — powers the homepage Kits tab">
            <StandardsInput value={tags} onChange={setTags} placeholder="kit, bestseller…" ariaLabel="Product tags" />
          </Field>
          <Field label="Images">
            <ImageUploader images={images} onChange={setImages} />
          </Field>
        </div>

        {/* Sidebar */}
        <div className="space-y-5 border-2 border-ink-900 bg-white p-6">
          <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </SelectField>
          <SelectField label="Brand" value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            <option value="">— none —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </SelectField>
          <SelectField label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— none —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </SelectField>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              aria-label="Featured product"
              checked={featured}
              onChange={(e) => setFeatured(e.target.checked)}
              className="h-5 w-5 accent-[#00E000]"
            />
            <span className="font-display text-sm font-bold uppercase tracking-wideCaps">
              Featured
            </span>
          </label>
        </div>
      </div>

      {/* Variants */}
      <div className="border-2 border-ink-900 bg-white">
        <div className="flex items-center justify-between border-b-2 border-ink-900 px-5 py-3">
          <h2 className="font-display text-lg font-black uppercase">Variants</h2>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setVariants((v) => [...v, { name: "", price_kes: "", initial_stock: "0", reorder_level: "10" }])
            }
          >
            + Add variant
          </Button>
        </div>
        <div className="divide-y-2 divide-ink-100">
          {variants.map((v, i) => (
            <div key={i} className="grid grid-cols-2 gap-3 p-4 md:grid-cols-5">
              <TextField label="Name" value={v.name} placeholder="e.g. Size L" onChange={(e) => setV(i, { name: e.target.value })} />
              <TextField label="Price (KES)" type="number" min="0" value={v.price_kes} onChange={(e) => setV(i, { price_kes: e.target.value })} required />
              <TextField label="Initial stock" type="number" min="0" value={v.initial_stock} onChange={(e) => setV(i, { initial_stock: e.target.value })} />
              <TextField label="Reorder level" type="number" min="0" value={v.reorder_level} onChange={(e) => setV(i, { reorder_level: e.target.value })} />
              <div className="flex items-end">
                {variants.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setVariants((vs) => vs.filter((_, idx) => idx !== i))}
                    className="border-2 border-hivis-500 px-3 py-2.5 font-display text-xs font-bold uppercase text-hivis-700 hover:bg-hivis-500 hover:text-white"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </form>
  );
}

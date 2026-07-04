"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, Product, Variant } from "@/lib/api";
import { Button, ConfirmDialog, Field, PageHead, SelectField, TextField, TextareaField, Toast } from "@/components/ui";
import { ImageUploader, Img, StandardsInput, useTaxonomy } from "@/components/product-bits";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { brands, categories } = useTaxonomy();
  const [p, setP] = useState<Product | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind?: "ok" | "err" } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [delBusy, setDelBusy] = useState(false);

  // editable field state
  const [f, setF] = useState({
    name: "", slug: "", summary: "", description: "",
    brand_id: "", category_id: "", status: "draft", is_featured: false,
  });
  const [standards, setStandards] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<Img[]>([]);

  const load = useCallback(async () => {
    const prod = await api.products.get(id);
    setP(prod);
    setF({
      name: prod.name, slug: prod.slug, summary: prod.summary || "",
      description: prod.description || "", brand_id: prod.brand_id || "",
      category_id: prod.category_id || "", status: prod.status, is_featured: prod.is_featured,
    });
    setStandards(prod.standards);
    setTags(prod.tags || []);
    setImages(prod.images);
  }, [id]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  function notify(msg: string, kind: "ok" | "err" = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2200);
  }

  async function saveFields(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.products.update(id, {
        name: f.name, slug: f.slug, summary: f.summary || null,
        description: f.description || null, brand_id: f.brand_id || null,
        category_id: f.category_id || null, status: f.status,
        is_featured: f.is_featured, standards, tags, images,
      });
      notify("Product saved");
      load();
    } catch (ex) {
      notify(ex instanceof Error ? ex.message : "Save failed", "err");
    } finally {
      setSaving(false);
    }
  }

  if (!p) {
    return <p className="font-mono text-sm text-ink-400">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHead
        eyebrow="Catalog / edit"
        title={p.name}
        action={
          <div className="flex gap-3">
            <a href={`http://localhost:3000/product/${p.slug}`} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" type="button">↗ View live</Button>
            </a>
            <Button type="button" onClick={saveFields} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      />

      <form onSubmit={saveFields} className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5 border-2 border-ink-900 bg-white p-6">
          <TextField label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <TextField label="Slug" className="font-mono" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} />
          <TextField label="Summary" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
          <TextareaField label="Description" className="min-h-[120px]" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          <Field label="Standards">
            <StandardsInput value={standards} onChange={setStandards} />
          </Field>
          <Field label="Tags" hint="e.g. kit — powers the homepage Kits tab">
            <StandardsInput value={tags} onChange={setTags} placeholder="kit, bestseller…" ariaLabel="Product tags" />
          </Field>
          <Field label="Images">
            <ImageUploader images={images} onChange={setImages} />
          </Field>
        </div>

        <div className="space-y-5 border-2 border-ink-900 bg-white p-6">
          <SelectField label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </SelectField>
          <SelectField label="Brand" value={f.brand_id} onChange={(e) => setF({ ...f, brand_id: e.target.value })}>
            <option value="">— none —</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </SelectField>
          <SelectField label="Category" value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}>
            <option value="">— none —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
          <label className="flex items-center gap-3">
            <input type="checkbox" aria-label="Featured product" checked={f.is_featured} onChange={(e) => setF({ ...f, is_featured: e.target.checked })} className="h-5 w-5 accent-[#00E000]" />
            <span className="font-display text-sm font-bold uppercase tracking-wideCaps">Featured</span>
          </label>
          <div className="border-t-2 border-ink-100 pt-4">
            <Button
              type="button"
              variant="danger"
              className="w-full"
              onClick={() => setConfirmDel(true)}
            >
              Delete product
            </Button>
          </div>
        </div>
      </form>

      <VariantsManager product={p} onChange={load} notify={notify} />

      <ConfirmDialog
        open={confirmDel}
        title="Delete product"
        message={`“${p.name}” and its variants + stock history will be permanently removed. This cannot be undone.`}
        busy={delBusy}
        onConfirm={async () => {
          setDelBusy(true);
          try {
            await api.products.remove(id);
            router.replace("/products");
          } finally {
            setDelBusy(false);
          }
        }}
        onCancel={() => setConfirmDel(false)}
      />

      {toast && <Toast msg={toast.msg} kind={toast.kind} />}
    </div>
  );
}

function VariantsManager({
  product,
  onChange,
  notify,
}: {
  product: Product;
  onChange: () => void;
  notify: (m: string, k?: "ok" | "err") => void;
}) {
  const [adding, setAdding] = useState(false);
  const [nv, setNv] = useState({ name: "", price_kes: "", initial_stock: "0", reorder_level: "10" });

  async function addVariant() {
    try {
      await api.products.addVariant(product.id, {
        name: nv.name || null,
        price_kes: Number(nv.price_kes),
        initial_stock: Number(nv.initial_stock || 0),
        reorder_level: Number(nv.reorder_level || 0),
      });
      setNv({ name: "", price_kes: "", initial_stock: "0", reorder_level: "10" });
      setAdding(false);
      notify("Variant added");
      onChange();
    } catch (ex) {
      notify(ex instanceof Error ? ex.message : "Failed", "err");
    }
  }

  return (
    <div className="border-2 border-ink-900 bg-white">
      <div className="flex items-center justify-between border-b-2 border-ink-900 px-5 py-3">
        <h2 className="font-display text-lg font-black uppercase">Variants & stock</h2>
        <Button type="button" variant="ghost" onClick={() => setAdding((a) => !a)}>
          {adding ? "Close" : "+ Add variant"}
        </Button>
      </div>

      {adding && (
        <div className="grid grid-cols-2 gap-3 border-b-2 border-ink-900 bg-ink-50 p-4 md:grid-cols-5">
          <TextField label="Name" value={nv.name} onChange={(e) => setNv({ ...nv, name: e.target.value })} />
          <TextField label="Price (KES)" type="number" value={nv.price_kes} onChange={(e) => setNv({ ...nv, price_kes: e.target.value })} />
          <TextField label="Initial stock" type="number" value={nv.initial_stock} onChange={(e) => setNv({ ...nv, initial_stock: e.target.value })} />
          <TextField label="Reorder" type="number" value={nv.reorder_level} onChange={(e) => setNv({ ...nv, reorder_level: e.target.value })} />
          <div className="flex items-end">
            <Button type="button" onClick={addVariant}>Save</Button>
          </div>
        </div>
      )}

      <div className="divide-y-2 divide-ink-100">
        {product.variants.map((v) => (
          <VariantRow key={v.id} productId={product.id} variant={v} onChange={onChange} notify={notify} />
        ))}
        {product.variants.length === 0 && (
          <p className="p-5 font-mono text-sm text-ink-400">No variants yet.</p>
        )}
      </div>
    </div>
  );
}

function VariantRow({
  productId,
  variant,
  onChange,
  notify,
}: {
  productId: string;
  variant: Variant;
  onChange: () => void;
  notify: (m: string, k?: "ok" | "err") => void;
}) {
  const [price, setPrice] = useState(String(variant.price_kes));
  const [name, setName] = useState(variant.name || "");
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("restock");

  async function savePrice() {
    await api.products.updateVariant(productId, variant.id, {
      price_kes: Number(price),
      name: name || null,
    });
    notify("Variant updated");
    onChange();
  }
  async function adjust() {
    if (!delta) return;
    await api.inventory.adjust(variant.id, { delta: Number(delta), reason });
    setDelta("");
    notify(`Stock ${Number(delta) >= 0 ? "+" : ""}${delta}`);
    onChange();
  }

  const low = variant.quantity_on_hand <= variant.reorder_level;

  return (
    <div className="grid grid-cols-1 items-end gap-3 p-4 md:grid-cols-[1fr_auto_auto_auto]">
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Price (KES)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        <div className="col-span-2 font-mono text-xs text-ink-400">SKU {variant.sku}</div>
      </div>

      <div className="text-center">
        <div className="font-display text-xs font-bold uppercase tracking-wideCaps text-ink-500">On hand</div>
        <div className={`font-display text-3xl font-black ${low ? "text-hivis-700" : "text-royal-600"}`}>
          {variant.quantity_on_hand}
        </div>
      </div>

      <div className="flex items-end gap-2">
        <TextField label="Adjust" type="number" className="w-24" placeholder="±" value={delta} onChange={(e) => setDelta(e.target.value)} />
        <SelectField label="Reason" className="w-28" value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="restock">Restock</option>
          <option value="adjustment">Adjust</option>
          <option value="return">Return</option>
          <option value="sale">Sale</option>
        </SelectField>
        <Button type="button" variant="ghost" onClick={adjust}>Apply</Button>
      </div>

      <div className="flex items-end gap-2">
        <Button type="button" onClick={savePrice}>Save</Button>
        <button
          type="button"
          onClick={async () => {
            if (!confirm("Delete this variant?")) return;
            await api.products.removeVariant(productId, variant.id);
            notify("Variant deleted");
            onChange();
          }}
          className="border-2 border-hivis-500 px-3 py-2.5 font-display text-xs font-bold uppercase text-hivis-700 hover:bg-hivis-500 hover:text-white"
        >
          Del
        </button>
      </div>
    </div>
  );
}

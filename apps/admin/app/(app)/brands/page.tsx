"use client";

import { useEffect, useState } from "react";
import { api, Brand } from "@/lib/api";
import { Button, PageHead, TextField, Toast, inputCls } from "@/components/ui";

export default function BrandsPage() {
  const [items, setItems] = useState<Brand[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setItems(await api.brands.list());
  }
  useEffect(() => {
    load().catch(() => {});
  }, []);
  function notify(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2000);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.brands.create({ name });
    setName("");
    notify("Brand created");
    load();
  }
  async function uploadLogo(b: Brand, file: File) {
    const url = await api.uploadImage(file);
    await api.brands.update(b.id, { logo_url: url });
    notify("Logo updated");
    load();
  }

  return (
    <div className="space-y-6">
      <PageHead eyebrow="Catalog" title="Brands" />

      <form onSubmit={create} className="flex flex-wrap items-end gap-3 border-2 border-ink-900 bg-white p-4">
        <div className="flex-1 min-w-[220px]">
          <TextField label="New brand name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MSA Safety" />
        </div>
        <Button type="submit">+ Create</Button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((b) => (
          <div key={b.id} className="border-2 border-ink-900 bg-white">
            <div className="flex h-28 items-center justify-center border-b-2 border-ink-900 bg-ink-50 p-3">
              {b.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.logo_url} alt={b.name} className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="font-display text-2xl font-black uppercase text-ink-300">{b.name}</span>
              )}
            </div>
            <div className="p-4">
              {editing === b.id ? (
                <div className="flex gap-2">
                  <input aria-label="Brand name" className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <Button type="button" onClick={async () => { await api.brands.update(b.id, { name: editName }); setEditing(null); notify("Saved"); load(); }}>Save</Button>
                </div>
              ) : (
                <div className="font-display text-lg font-bold uppercase">{b.name}</div>
              )}
              <div className="font-mono text-xs text-ink-400">{b.slug}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="cursor-pointer border-2 border-ink-900 px-2.5 py-1 font-display text-xs font-bold uppercase hover:bg-ink-900 hover:text-white">
                  Logo
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(b, f); e.target.value = ""; }} />
                </label>
                <button type="button" onClick={() => { setEditing(b.id); setEditName(b.name); }} className="border-2 border-ink-900 px-2.5 py-1 font-display text-xs font-bold uppercase hover:bg-ink-900 hover:text-white">Rename</button>
                <button type="button" onClick={async () => { if (!confirm(`Delete ${b.name}?`)) return; await api.brands.remove(b.id); notify("Deleted"); load(); }} className="border-2 border-hivis-500 px-2.5 py-1 font-display text-xs font-bold uppercase text-hivis-700 hover:bg-hivis-500 hover:text-white">Del</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {toast && <Toast msg={toast} />}
    </div>
  );
}

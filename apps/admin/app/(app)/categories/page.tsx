"use client";

import { useEffect, useState } from "react";
import { api, Category } from "@/lib/api";
import { Button, PageHead, TextField, Toast, inputCls } from "@/components/ui";

export default function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setItems(await api.categories.list());
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
    await api.categories.create({ name });
    setName("");
    notify("Category created");
    load();
  }
  async function saveEdit() {
    if (!editing) return;
    await api.categories.update(editing.id, { name: editName });
    setEditing(null);
    notify("Category updated");
    load();
  }
  async function remove(c: Category) {
    if (!confirm(`Delete category “${c.name}”?`)) return;
    await api.categories.remove(c.id);
    notify("Category deleted");
    load();
  }

  return (
    <div className="space-y-6">
      <PageHead eyebrow="Catalog" title="Categories" />

      <form onSubmit={create} className="flex flex-wrap items-end gap-3 border-2 border-ink-900 bg-white p-4">
        <div className="flex-1 min-w-[220px]">
          <TextField label="New category name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fall Protection" />
        </div>
        <Button type="submit">+ Create</Button>
      </form>

      <div className="overflow-x-auto border-2 border-ink-900 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b-2 border-ink-900 text-left font-display text-xs uppercase tracking-wideCaps">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 font-mono">Slug</th>
              <th className="px-4 py-3 text-right">Products</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-ink-200 last:border-0 hover:bg-ink-50">
                <td className="px-4 py-3">
                  {editing?.id === c.id ? (
                    <input aria-label="Category name" className={inputCls} value={editName} onChange={(e) => setEditName(e.target.value)} />
                  ) : (
                    <span className="font-semibold">{c.name}</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-ink-500">{c.slug}</td>
                <td className="px-4 py-3 text-right font-mono">{c.product_count}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {editing?.id === c.id ? (
                      <>
                        <Button type="button" onClick={saveEdit}>Save</Button>
                        <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => { setEditing(c); setEditName(c.name); }} className="border-2 border-ink-900 px-2.5 py-1 font-display text-xs font-bold uppercase hover:bg-ink-900 hover:text-white">Edit</button>
                        <button type="button" onClick={() => remove(c)} className="border-2 border-hivis-500 px-2.5 py-1 font-display text-xs font-bold uppercase text-hivis-700 hover:bg-hivis-500 hover:text-white">Del</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {toast && <Toast msg={toast} />}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ContentBlock } from "@/lib/api";
import { Button, PageHead, TextField, TextareaField, Toast, inputCls } from "@/components/ui";

export default function ContentPage() {
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => setBlocks(await api.content.list()), []);
  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  function notify(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 2000);
  }

  return (
    <div className="space-y-6">
      <PageHead eyebrow="Storefront" title="Content" />
      <p className="max-w-2xl text-sm text-ink-600">
        Control what the commercial site shows — the homepage hero, banners and promo
        blocks. Changes go live on the storefront immediately.
      </p>

      <div className="space-y-6">
        {blocks.map((b) => (
          <BlockEditor key={b.id} block={b} onSaved={() => { load(); notify("Saved"); }} />
        ))}
        {blocks.length === 0 && (
          <div className="border-2 border-ink-900 bg-white p-8 font-mono text-sm text-ink-400">
            No content blocks.
          </div>
        )}
      </div>

      {toast && <Toast msg={toast} />}
    </div>
  );
}

function BlockEditor({ block, onSaved }: { block: ContentBlock; onSaved: () => void }) {
  const [title, setTitle] = useState(block.title || "");
  const [body, setBody] = useState(block.body || "");
  const [active, setActive] = useState(block.is_active);
  const [pairs, setPairs] = useState<[string, string][]>(Object.entries(block.data || {}));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const data = Object.fromEntries(pairs.filter(([k]) => k.trim()));
      await api.content.update(block.id, { title: title || null, body: body || null, is_active: active, data });
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-2 border-ink-900 bg-white">
      <div className="flex items-center justify-between border-b-2 border-ink-900 bg-ink-50 px-5 py-3">
        <div>
          <span className="font-mono text-xs text-ink-400">{block.kind}</span>
          <h3 className="font-display text-lg font-black uppercase">{block.key}</h3>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" aria-label="Active" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-[#00E000]" />
          <span className="font-display text-xs font-bold uppercase tracking-wideCaps">Active</span>
        </label>
      </div>
      <div className="space-y-4 p-5">
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextareaField label="Body" className="min-h-[80px]" value={body} onChange={(e) => setBody(e.target.value)} />

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-display text-xs font-bold uppercase tracking-wideCaps text-ink-700">Data fields</span>
            <button type="button" onClick={() => setPairs((p) => [...p, ["", ""]])} className="font-mono text-xs text-royal-600 hover:underline">+ add field</button>
          </div>
          <div className="space-y-2">
            {pairs.map(([k, v], i) => (
              <div key={i} className="flex gap-2">
                <input aria-label="Field key" className={`${inputCls} max-w-[200px] font-mono`} value={k} placeholder="key" onChange={(e) => setPairs((p) => p.map((pp, idx) => (idx === i ? [e.target.value, pp[1]] : pp)))} />
                <input aria-label="Field value" className={inputCls} value={v} placeholder="value" onChange={(e) => setPairs((p) => p.map((pp, idx) => (idx === i ? [pp[0], e.target.value] : pp)))} />
                <button type="button" aria-label="Remove field" onClick={() => setPairs((p) => p.filter((_, idx) => idx !== i))} className="w-10 shrink-0 border-2 border-hivis-500 font-bold text-hivis-700 hover:bg-hivis-500 hover:text-white">×</button>
              </div>
            ))}
          </div>
        </div>

        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save block"}</Button>
      </div>
    </div>
  );
}

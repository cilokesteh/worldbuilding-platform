"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";

type MediaItem = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: string;
  createdById: string;
  uploader: { id: string; name: string } | null;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function MediaPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const worldId = params.worldId as string;

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/worlds/${worldId}/media`);
      const json = (await res.json()) as {
        ok: boolean;
        data?: { items: MediaItem[] };
        error?: string;
      };
      if (!json.ok) throw new Error(json.error ?? "Gagal memuat media.");
      setItems(json.data?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat media.");
    } finally {
      setLoading(false);
    }
  }, [worldId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Pilih file dulu.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError("Ukuran file maksimal 6 MB.");
      return;
    }
    setUploading(true);
    setError(null);
    setNotice(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/worlds/${worldId}/media`, {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Upload gagal.");
      setNotice(`"${file.name}" berhasil diunggah.`);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload gagal.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(item: MediaItem) {
    if (!window.confirm(`Hapus "${item.filename}"? File yang dihapus tidak bisa dikembalikan.`)) return;
    setDeletingId(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/worlds/${worldId}/media/${item.id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) throw new Error(json.error ?? "Gagal menghapus media.");
      setNotice(`"${item.filename}" dihapus.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus media.");
    } finally {
      setDeletingId(null);
    }
  }

  async function copyMarkdown(item: MediaItem) {
    const syntax = `![${item.filename}](/api/worlds/${worldId}/media/${item.id}/file)`;
    try {
      await navigator.clipboard.writeText(syntax);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId((cur) => (cur === item.id ? null : cur)), 2000);
    } catch {
      setError("Gagal menyalin. Salin manual dari kolom sintaks di bawah gambar.");
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-8">
      <Link
        href={`/w/${workspaceId}/worlds/${worldId}`}
        className="text-sm font-medium text-emerald-700 hover:underline"
      >
        ← Kembali ke dunia
      </Link>
      <div className="mt-3">
        <PageHeader
          title="Media"
          desc="Galeri gambar dan file dunia ini. File disimpan di database (maks 6 MB per file) dan bisa disisipkan ke artikel dengan sintaks Markdown."
        />
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      <Card className="mb-6">
        <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-3">
          <label className="block flex-1">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Unggah file (gambar, PDF, atau teks — maks 6 MB)
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf,text/*"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
          <Button type="submit" disabled={uploading}>
            {uploading ? "Mengunggah…" : "Unggah"}
          </Button>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Butuh peran Kontributor atau lebih tinggi untuk mengunggah; menghapus butuh Editor.
        </p>
      </Card>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-500">Memuat media…</p>
      ) : items.length === 0 ? (
        <EmptyState
          title="Belum ada media"
          desc="Unggah gambar peta, ilustrasi karakter, atau dokumen pendukung dunia Anda."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const fileUrl = `/api/worlds/${worldId}/media/${item.id}/file`;
            const isImage = item.mimeType.startsWith("image/");
            return (
              <Card key={item.id} className="flex flex-col gap-3">
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fileUrl}
                    alt={item.filename}
                    className="h-44 w-full rounded-lg border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-44 w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
                    <div className="text-center">
                      <p className="text-3xl">📄</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">{item.mimeType}</p>
                    </div>
                  </div>
                )}
                <div>
                  <p className="truncate text-sm font-semibold text-slate-900" title={item.filename}>
                    {item.filename}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatSize(item.size)} · {formatDate(item.createdAt)}
                    {item.uploader ? ` · oleh ${item.uploader.name}` : ""}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-600">Sintaks Markdown untuk artikel:</p>
                  <code className="block overflow-x-auto rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] break-all text-slate-700">
                    ![{item.filename}]({fileUrl})
                  </code>
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => void copyMarkdown(item)}>
                    {copiedId === item.id ? "Disalin ✓" : "Salin sintaks"}
                  </Button>
                  <Button
                    variant="secondary"
                    href={fileUrl}
                  >
                    Buka file
                  </Button>
                  <Button
                    variant="danger"
                    disabled={deletingId === item.id}
                    onClick={() => void handleDelete(item)}
                  >
                    {deletingId === item.id ? "Menghapus…" : "Hapus"}
                  </Button>
                </div>
                {isImage && <Badge tone="emerald">Gambar</Badge>}
                {!isImage && item.mimeType === "application/pdf" && <Badge tone="sky">PDF</Badge>}
                {!isImage && item.mimeType !== "application/pdf" && <Badge tone="slate">Teks</Badge>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

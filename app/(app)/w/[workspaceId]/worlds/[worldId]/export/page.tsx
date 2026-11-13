"use client";

import { useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, PageHeader } from "@/components/ui";

type ImportResult = {
  world: { id: string; name: string };
  imported: {
    categories: number;
    templates: number;
    articles: number;
    relationships: number;
  };
};

export default function ExportImportPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const worldId = params.worldId as string;

  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Pilih file JSON hasil export dulu.");
      return;
    }
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      let data: unknown;
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        throw new Error("File bukan JSON yang valid.");
      }
      const res = await fetch(`/api/worlds/${worldId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, data }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: ImportResult;
        error?: string;
      };
      if (!json.ok || !json.data) {
        throw new Error(json.error ?? "Impor gagal.");
      }
      setResult(json.data);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impor gagal.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-8">
      <Link
        href={`/w/${workspaceId}/worlds/${worldId}`}
        className="text-sm font-medium text-emerald-700 hover:underline"
      >
        ← Kembali ke dunia
      </Link>
      <div className="mt-3">
        <PageHeader
          title="Ekspor & Impor"
          desc="Bawa pulang datamu kapan pun — tanpa paywall, tanpa penahanan data."
        />
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {result && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-semibold">Impor berhasil: {result.world.name}</p>
          <p className="mt-1">
            {result.imported.categories} kategori · {result.imported.templates} template ·{" "}
            {result.imported.articles} artikel · {result.imported.relationships} relasi
          </p>
          <Link
            href={`/w/${workspaceId}/worlds/${result.world.id}`}
            className="mt-2 inline-block font-medium underline"
          >
            Buka dunia hasil impor →
          </Link>
        </div>
      )}

      <div className="grid gap-4">
        <Card>
          <h2 className="text-base font-semibold text-slate-900">Ekspor dunia ini</h2>
          <p className="mt-1 text-sm text-slate-600">
            Unduh seluruh isi dunia — kategori, template, artikel, relasi, dan metadata media —
            sebagai satu file JSON. File ini bisa diimpor kembali ke workspace mana pun.
          </p>
          <div className="mt-4">
            <Button href={`/api/worlds/${worldId}/export`}>Unduh JSON dunia</Button>
          </div>
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Catatan: file media (gambar/PDF) tidak ikut ter-export sebagai file — hanya
            metadata-nya (nama, tipe, ukuran). Unduh tiap file media secara terpisah dari halaman
            Media bila diperlukan.
          </p>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-slate-900">Impor dunia dari JSON</h2>
          <p className="mt-1 text-sm text-slate-600">
            Pilih file JSON hasil export platform ini. Dunia baru akan dibuat dengan nama yang sama
            ditambah &quot;(Impor)&quot; — dunia yang sudah ada tidak akan tertimpa. Butuh peran
            Editor atau lebih tinggi.
          </p>
          <form onSubmit={handleImport} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block flex-1">
              <span className="mb-1 block text-sm font-medium text-slate-700">File JSON export</span>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <Button type="submit" disabled={importing}>
              {importing ? "Mengimpor…" : "Impor"}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-slate-900">Ekspor seluruh data akun</h2>
          <p className="mt-1 text-sm text-slate-600">
            Unduh semua data Anda dalam satu file: profil, workspace yang Anda miliki dan ikuti,
            semua dunia beserta artikel, kategori, template, relasi, dan metadata media. Berguna
            untuk arsip pribadi atau pindah platform.
          </p>
          <div className="mt-4">
            <Button href="/api/account/export" variant="secondary">
              Unduh seluruh data akun (JSON)
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

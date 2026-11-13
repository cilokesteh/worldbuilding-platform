"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";

type TemplateItem = { id: string; name: string; isBuiltIn: boolean };
type CategoryItem = { id: string; name: string; color: string | null };
type ArticleItem = {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PUBLISHED" | "PRIVATE";
  wordCount: number;
  excerpt: string | null;
  updatedAt: string;
  template: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  author: { id: string; name: string } | null;
};

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json()) as ApiResult<T>;
  if (!res.ok || !json.ok) throw new Error(!json.ok ? json.error : `Gagal memuat (${res.status})`);
  return json.data;
}

const STATUS_LABEL: Record<ArticleItem["status"], string> = {
  DRAFT: "Draf",
  PUBLISHED: "Terbit",
  PRIVATE: "Pribadi",
};

const STATUS_TONE: Record<ArticleItem["status"], "slate" | "emerald" | "amber"> = {
  DRAFT: "slate",
  PUBLISHED: "emerald",
  PRIVATE: "amber",
};

export default function ArticlesPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const worldId = params.worldId as string;
  const base = `/w/${workspaceId}/worlds/${worldId}`;

  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newTemplateId, setNewTemplateId] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      if (status) sp.set("status", status);
      if (categoryId) sp.set("categoryId", categoryId);
      const [arts, tmpls, cats] = await Promise.all([
        api<ArticleItem[]>(`/api/worlds/${worldId}/articles?${sp.toString()}`),
        api<TemplateItem[]>(`/api/templates?worldId=${worldId}`),
        api<CategoryItem[]>(`/api/worlds/${worldId}/categories`),
      ]);
      setArticles(arts);
      setTemplates(tmpls);
      setCategories(cats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat artikel");
    } finally {
      setLoading(false);
    }
  }, [worldId, q, status, categoryId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createArticle(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!newTitle.trim()) {
      setFormError("Judul artikel wajib diisi");
      return;
    }
    setCreating(true);
    try {
      const created = await api<ArticleItem>(`/api/worlds/${worldId}/articles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          templateId: newTemplateId || undefined,
          categoryId: newCategoryId || undefined,
        }),
      });
      router.push(`${base}/articles/${created.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal membuat artikel");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title="Artikel"
        desc="Semua artikel di world ini. Cari, saring, lalu buka untuk membaca atau mengedit."
        actions={
          <>
            <Button href={`${base}/templates`} variant="secondary">
              Template
            </Button>
            <Button onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Tutup form" : "+ Artikel Baru"}
            </Button>
          </>
        }
      />

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={createArticle} className="space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Buat artikel baru</h2>
            <Input
              label="Judul"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="cth. Nara Kirana"
              required
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Template"
                value={newTemplateId}
                onChange={(e) => setNewTemplateId(e.target.value)}
              >
                <option value="">— Tanpa template —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.isBuiltIn ? " (Bawaan)" : ""}
                  </option>
                ))}
              </Select>
              <Select
                label="Kategori"
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
              >
                <option value="">— Tanpa kategori —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            {formError && <p className="text-sm text-red-700">{formError}</p>}
            <Button type="submit" disabled={creating}>
              {creating ? "Membuat…" : "Buat artikel"}
            </Button>
          </form>
        </Card>
      )}

      <Card className="mb-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            label="Cari judul / isi"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ketik kata kunci…"
          />
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua status</option>
            <option value="DRAFT">Draf</option>
            <option value="PUBLISHED">Terbit</option>
            <option value="PRIVATE">Pribadi</option>
          </Select>
          <Select label="Kategori" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Semua kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Memuat artikel…</p>
      ) : articles.length === 0 ? (
        <EmptyState
          title="Belum ada artikel"
          desc="Buat artikel pertamamu untuk mulai membangun dunia ini."
          action={<Button onClick={() => setShowForm(true)}>+ Artikel Baru</Button>}
        />
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    href={`${base}/articles/${a.id}`}
                    className="text-base font-semibold text-emerald-800 hover:underline"
                  >
                    {a.title}
                  </Link>
                  {a.excerpt && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{a.excerpt}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {a.template && <Badge tone="sky">{a.template.name}</Badge>}
                    {a.category && <Badge>{a.category.name}</Badge>}
                    <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                    <span>{a.wordCount} kata</span>
                    <span>
                      Diubah{" "}
                      {new Date(a.updatedAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    {a.author && <span>oleh {a.author.name}</span>}
                  </div>
                </div>
                <Button href={`${base}/articles/${a.id}`} variant="secondary">
                  Buka
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { renderMarkdown } from "@/lib/markdown";
import { extractLinks, renderWikiLinks } from "@/lib/autolink";
import type { TemplateFieldDef } from "@/lib/seed-data";

type Status = "DRAFT" | "PUBLISHED" | "PRIVATE";

type TemplateItem = {
  id: string;
  name: string;
  isBuiltIn: boolean;
  fields: TemplateFieldDef[];
};
type CategoryItem = { id: string; name: string };
type ArticleRef = { id: string; title: string; slug: string; content?: string };
type CommentItem = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string };
};
type VersionItem = {
  id: string;
  title: string;
  content: string;
  fieldValues: Record<string, unknown>;
  note: string | null;
  createdAt: string;
  author: { id: string; name: string };
};
type ArticleDetail = {
  id: string;
  worldId: string;
  templateId: string | null;
  categoryId: string | null;
  title: string;
  slug: string;
  content: string;
  fieldValues: Record<string, unknown>;
  excerpt: string | null;
  status: Status;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  template: { id: string; name: string; fields: unknown } | null;
  category: { id: string; name: string } | null;
  author: { id: string; name: string };
  versionCount: number;
  commentCount: number;
  comments: CommentItem[];
};
type RelItem = {
  id: string;
  fromArticleId: string;
  toArticleId: string;
  type: string;
  label: string | null;
  createdAt: string;
  from: { id: string; title: string; slug: string };
  to: { id: string; title: string; slug: string };
};
type Suggestion = {
  entityId: string;
  title: string;
  slug: string;
  index: number;
  context: string;
};

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json()) as ApiResult<T>;
  if (!res.ok || !json.ok) throw new Error(!json.ok ? json.error : `Gagal memuat (${res.status})`);
  return json.data;
}

const STATUS_LABEL: Record<Status, string> = { DRAFT: "Draf", PUBLISHED: "Terbit", PRIVATE: "Pribadi" };
const STATUS_TONE: Record<Status, "slate" | "emerald" | "amber"> = {
  DRAFT: "slate",
  PUBLISHED: "emerald",
  PRIVATE: "amber",
};
const REL_TYPES = ["Keluarga", "Pertemanan", "Rivalitas", "Kemitraan", "Musuh", "Mentor/Murid", "Anggota", "Menjaga", "Tinggal di", "Terjadi di", "Melibatkan", "Muncul di"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function fieldValueToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map((x) => String(x)).join("\n");
  if (typeof v === "boolean") return v ? "Ya" : "Tidak";
  return String(v);
}

/** Render input sesuai definisi field template. */
function TemplateFieldsForm({
  fields,
  values,
  onChange,
  articles,
}: {
  fields: TemplateFieldDef[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  articles: ArticleRef[];
}) {
  const sorted = [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return (
    <div className="space-y-4">
      {sorted.map((f) => {
        const value = values[f.key];
        const label = `${f.label}${f.required ? " *" : ""}`;
        switch (f.type) {
          case "longtext":
            return (
              <Textarea
                key={f.key}
                label={label}
                rows={3}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.prompt}
              />
            );
          case "number":
            return (
              <Input
                key={f.key}
                label={label}
                type="number"
                value={typeof value === "number" ? value : value ? String(value) : ""}
                onChange={(e) => onChange(f.key, e.target.value === "" ? "" : Number(e.target.value))}
              />
            );
          case "date":
            return (
              <Input
                key={f.key}
                label={label}
                type="date"
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(f.key, e.target.value)}
              />
            );
          case "dropdown":
            return (
              <Select
                key={f.key}
                label={label}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(f.key, e.target.value)}
              >
                <option value="">— Pilih —</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            );
          case "multiselect": {
            const selected = Array.isArray(value) ? (value as unknown[]).map(String) : [];
            return (
              <div key={f.key}>
                <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
                <div className="flex flex-wrap gap-3 rounded-lg border border-slate-300 px-3 py-2">
                  {(f.options ?? []).map((o) => (
                    <label key={o} className="flex items-center gap-1.5 text-sm text-slate-800">
                      <input
                        type="checkbox"
                        checked={selected.includes(o)}
                        onChange={(e) =>
                          onChange(
                            f.key,
                            e.target.checked ? [...selected, o] : selected.filter((x) => x !== o),
                          )
                        }
                      />
                      {o}
                    </label>
                  ))}
                  {(f.options ?? []).length === 0 && (
                    <span className="text-sm text-slate-400">Tidak ada opsi.</span>
                  )}
                </div>
              </div>
            );
          }
          case "checkbox":
            return (
              <label key={f.key} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={value === true}
                  onChange={(e) => onChange(f.key, e.target.checked)}
                />
                {label}
              </label>
            );
          case "url":
            return (
              <Input
                key={f.key}
                label={label}
                type="url"
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder="https://…"
              />
            );
          case "entity":
            return (
              <Select
                key={f.key}
                label={label}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(f.key, e.target.value)}
              >
                <option value="">— Pilih artikel —</option>
                {articles.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </Select>
            );
          case "image":
            return (
              <Input
                key={f.key}
                label={label}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder="URL gambar atau ID media"
              />
            );
          case "repeater":
            return (
              <Textarea
                key={f.key}
                label={`${label} (satu nilai per baris)`}
                rows={3}
                value={Array.isArray(value) ? (value as unknown[]).map(String).join("\n") : ""}
                onChange={(e) =>
                  onChange(
                    f.key,
                    e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                  )
                }
              />
            );
          default:
            return (
              <Input
                key={f.key}
                label={label}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.prompt}
              />
            );
        }
      })}
    </div>
  );
}

export default function ArticlePage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;
  const worldId = params.worldId as string;
  const articleId = params.articleId as string;
  const base = `/w/${workspaceId}/worlds/${worldId}`;

  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [allArticles, setAllArticles] = useState<ArticleRef[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [rels, setRels] = useState<RelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [mode, setMode] = useState<"read" | "edit">("read");
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTemplateId, setEditTemplateId] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editStatus, setEditStatus] = useState<Status>("DRAFT");
  const [editFieldValues, setEditFieldValues] = useState<Record<string, unknown>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [checkingLinks, setCheckingLinks] = useState(false);
  const [applyingLinks, setApplyingLinks] = useState(false);

  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const [relToId, setRelToId] = useState("");
  const [relType, setRelType] = useState("");
  const [relLabel, setRelLabel] = useState("");
  const [relError, setRelError] = useState("");
  const [addingRel, setAddingRel] = useState(false);

  const loadArticle = useCallback(async () => {
    const a = await api<ArticleDetail>(`/api/articles/${articleId}`);
    setArticle(a);
    return a;
  }, [articleId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [, all, tmpls, cats, vers, relList] = await Promise.all([
        loadArticle(),
        api<ArticleRef[]>(`/api/worlds/${worldId}/articles`),
        api<TemplateItem[]>(`/api/templates?worldId=${worldId}`),
        api<CategoryItem[]>(`/api/worlds/${worldId}/categories`),
        api<VersionItem[]>(`/api/articles/${articleId}/versions`),
        api<RelItem[]>(`/api/worlds/${worldId}/relationships`),
      ]);
      setAllArticles(all);
      setTemplates(tmpls);
      setCategories(cats);
      setVersions(vers);
      setRels(relList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat artikel");
    } finally {
      setLoading(false);
    }
  }, [articleId, worldId, loadArticle]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const wikiMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of allArticles) m.set(a.title, `${base}/articles/${a.id}`);
    return m;
  }, [allArticles, base]);

  const backlinks = useMemo(() => {
    if (!article) return [];
    return allArticles.filter(
      (a) => a.id !== article.id && a.content && extractLinks(a.content).includes(article.title),
    );
  }, [allArticles, article]);

  const myRels = useMemo(
    () => rels.filter((r) => r.fromArticleId === articleId || r.toArticleId === articleId),
    [rels, articleId],
  );

  const editTemplateFields: TemplateFieldDef[] = useMemo(() => {
    const t = templates.find((x) => x.id === editTemplateId);
    if (t) return t.fields;
    if (article?.template) {
      return (Array.isArray(article.template.fields) ? article.template.fields : []) as TemplateFieldDef[];
    }
    return [];
  }, [templates, editTemplateId, article]);

  function enterEdit() {
    if (!article) return;
    setEditTitle(article.title);
    setEditContent(article.content);
    setEditTemplateId(article.templateId ?? "");
    setEditCategoryId(article.categoryId ?? "");
    setEditStatus(article.status);
    setEditFieldValues(article.fieldValues ?? {});
    setShowPreview(false);
    setSaveError("");
    setSavedAt(null);
    setSuggestions(null);
    setSelectedSuggestions([]);
    setMode("edit");
  }

  async function saveArticle(e?: React.FormEvent) {
    e?.preventDefault();
    if (!article) return;
    setSaveError("");
    setSaving(true);
    try {
      const updated = await api<ArticleDetail>(`/api/articles/${articleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent,
          fieldValues: editFieldValues,
          categoryId: editCategoryId || null,
          templateId: editTemplateId || null,
          status: editStatus,
        }),
      });
      setArticle(updated);
      const vers = await api<VersionItem[]>(`/api/articles/${articleId}/versions`);
      setVersions(vers);
      setSavedAt(
        new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Gagal menyimpan artikel");
    } finally {
      setSaving(false);
    }
  }

  async function checkLinks() {
    setCheckingLinks(true);
    try {
      const list = await api<Suggestion[]>(`/api/articles/${articleId}/suggest-links`);
      setSuggestions(list);
      setSelectedSuggestions(list.map((s) => s.title));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Gagal memeriksa tautan");
    } finally {
      setCheckingLinks(false);
    }
  }

  async function applyLinks() {
    if (selectedSuggestions.length === 0) return;
    setApplyingLinks(true);
    try {
      const res = await api<{ content: string; applied: number; changed: boolean }>(
        `/api/articles/${articleId}/suggest-links`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ acceptedTitles: selectedSuggestions }),
        },
      );
      if (res.changed) {
        setEditContent(res.content);
        const updated = await loadArticle();
        setArticle(updated);
        const vers = await api<VersionItem[]>(`/api/articles/${articleId}/versions`);
        setVersions(vers);
        setSavedAt(
          new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        );
      }
      setSuggestions(null);
      setSelectedSuggestions([]);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Gagal menerapkan tautan");
    } finally {
      setApplyingLinks(false);
    }
  }

  async function postComment(e: React.FormEvent) {
    e.preventDefault();
    setCommentError("");
    if (!commentBody.trim()) return;
    setPostingComment(true);
    try {
      await api(`/api/articles/${articleId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody.trim() }),
      });
      setCommentBody("");
      await loadArticle();
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : "Gagal mengirim komentar");
    } finally {
      setPostingComment(false);
    }
  }

  async function addRel(e: React.FormEvent) {
    e.preventDefault();
    setRelError("");
    if (!relToId || !relType.trim()) {
      setRelError("Pilih artikel tujuan dan isi jenis relasi");
      return;
    }
    setAddingRel(true);
    try {
      await api(`/api/worlds/${worldId}/relationships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromArticleId: articleId,
          toArticleId: relToId,
          type: relType.trim(),
          label: relLabel.trim() || undefined,
        }),
      });
      setRelToId("");
      setRelType("");
      setRelLabel("");
      const relList = await api<RelItem[]>(`/api/worlds/${worldId}/relationships`);
      setRels(relList);
    } catch (err) {
      setRelError(err instanceof Error ? err.message : "Gagal menambah relasi");
    } finally {
      setAddingRel(false);
    }
  }

  async function deleteRel(id: string) {
    if (!window.confirm("Hapus relasi ini?")) return;
    try {
      await api(`/api/relationships/${id}`, { method: "DELETE" });
      setRels((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setRelError(e instanceof Error ? e.message : "Gagal menghapus relasi");
    }
  }

  async function restoreVersion(versionId: string) {
    if (!window.confirm("Pulihkan artikel ke versi ini? Perubahan saat ini akan tersimpan sebagai versi baru.")) return;
    try {
      await api(`/api/articles/${articleId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const [updated, vers] = await Promise.all([
        loadArticle(),
        api<VersionItem[]>(`/api/articles/${articleId}/versions`),
      ]);
      setArticle(updated);
      setVersions(vers);
      setMode("read");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memulihkan versi");
    }
  }

  async function deleteArticle() {
    if (!window.confirm("Hapus artikel ini beserta semua versi dan komentarnya?")) return;
    try {
      await api(`/api/articles/${articleId}`, { method: "DELETE" });
      router.push(`${base}/articles`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus artikel");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-sm text-slate-500">Memuat artikel…</p>
      </div>
    );
  }
  if (error && !article) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <EmptyState title="Artikel tidak bisa dibuka" desc={error} action={<Button href={`${base}/articles`}>Kembali ke daftar</Button>} />
      </div>
    );
  }
  if (!article) return null;

  const renderedHtml = renderWikiLinks(renderMarkdown(article.content), wikiMap);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title={mode === "edit" ? "Edit Artikel" : article.title}
        desc={
          mode === "read"
            ? `Terakhir diubah ${fmtDateTime(article.updatedAt)} · ${article.wordCount} kata`
            : "Ubah judul, isi, field template, dan status, lalu simpan."
        }
        actions={
          <>
            <Button href={`${base}/articles`} variant="secondary">
              ← Daftar artikel
            </Button>
            {mode === "read" ? (
              <Button onClick={enterEdit}>Edit</Button>
            ) : (
              <Button variant="secondary" onClick={() => setMode("read")}>
                Batal
              </Button>
            )}
            <Button variant="danger" onClick={deleteArticle}>
              Hapus
            </Button>
          </>
        }
      />
      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

      {mode === "read" ? (
        <div className="space-y-6">
          <Card>
            <div className="mb-4 flex flex-wrap gap-2">
              {article.template && <Badge tone="sky">{article.template.name}</Badge>}
              {article.category && <Badge>{article.category.name}</Badge>}
              <Badge tone={STATUS_TONE[article.status]}>{STATUS_LABEL[article.status]}</Badge>
              <span className="text-xs text-slate-500">oleh {article.author.name}</span>
            </div>
            {article.template && Array.isArray(article.template.fields) && (article.template.fields as TemplateFieldDef[]).length > 0 && (
              <dl className="mb-5 grid gap-x-6 gap-y-3 border-b border-slate-100 pb-5 sm:grid-cols-2">
                {(article.template.fields as TemplateFieldDef[])
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((f) => {
                    const v = article.fieldValues[f.key];
                    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return null;
                    return (
                      <div key={f.key}>
                        <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{f.label}</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800">{fieldValueToString(v)}</dd>
                      </div>
                    );
                  })}
              </dl>
            )}
            {article.content ? (
              <div
                className="prose prose-slate max-w-none text-slate-800 [&_a]:text-emerald-700 [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            ) : (
              <p className="text-sm italic text-slate-400">Artikel ini belum berisi teks.</p>
            )}
          </Card>

          {backlinks.length > 0 && (
            <Card>
              <h2 className="mb-3 text-base font-semibold text-slate-900">Disebut di artikel lain</h2>
              <ul className="space-y-1">
                {backlinks.map((a) => (
                  <li key={a.id}>
                    <Link href={`${base}/articles/${a.id}`} className="text-sm text-emerald-700 hover:underline">
                      {a.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Relasi</h2>
            {myRels.length === 0 ? (
              <p className="mb-4 text-sm text-slate-500">Belum ada relasi untuk artikel ini.</p>
            ) : (
              <ul className="mb-4 space-y-2">
                {myRels.map((r) => {
                  const other = r.fromArticleId === articleId ? r.to : r.from;
                  const direction = r.fromArticleId === articleId ? "→" : "←";
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-slate-500">{direction}</span>
                      <Badge tone="sky">{r.type}</Badge>
                      <Link href={`${base}/articles/${other.id}`} className="font-medium text-emerald-700 hover:underline">
                        {other.title}
                      </Link>
                      {r.label && <span className="text-slate-500">— {r.label}</span>}
                      <button
                        type="button"
                        onClick={() => void deleteRel(r.id)}
                        className="text-xs text-red-700 hover:underline"
                      >
                        Hapus
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <form onSubmit={addRel} className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[1fr_180px_1fr_auto]">
              <Select label="Artikel tujuan" value={relToId} onChange={(e) => setRelToId(e.target.value)}>
                <option value="">— Pilih artikel —</option>
                {allArticles
                  .filter((a) => a.id !== articleId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
              </Select>
              <div>
                <Input
                  label="Jenis relasi"
                  value={relType}
                  onChange={(e) => setRelType(e.target.value)}
                  placeholder="cth. Anggota"
                  list="rel-types"
                />
                <datalist id="rel-types">
                  {REL_TYPES.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <Input label="Label (opsional)" value={relLabel} onChange={(e) => setRelLabel(e.target.value)} placeholder="cth. sejak 312" />
              <div className="flex items-end">
                <Button type="submit" disabled={addingRel}>
                  {addingRel ? "Menambah…" : "Tambah relasi"}
                </Button>
              </div>
            </form>
            {relError && <p className="mt-2 text-sm text-red-700">{relError}</p>}
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Komentar ({article.comments.length})</h2>
            {article.comments.length === 0 ? (
              <p className="mb-4 text-sm text-slate-500">Belum ada komentar.</p>
            ) : (
              <ul className="mb-4 space-y-3">
                {article.comments.map((c) => (
                  <li key={c.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-sm text-slate-800">{c.body}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {c.user.name} · {fmtDateTime(c.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={postComment} className="space-y-3">
              <Textarea
                label="Tulis komentar"
                rows={3}
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Berikan masukan atau pertanyaan…"
              />
              {commentError && <p className="text-sm text-red-700">{commentError}</p>}
              <Button type="submit" disabled={postingComment || !commentBody.trim()}>
                {postingComment ? "Mengirim…" : "Kirim komentar"}
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Riwayat versi ({versions.length})</h2>
            {versions.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada versi tersimpan.</p>
            ) : (
              <ul className="space-y-2">
                {versions.map((v, i) => (
                  <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-800">{v.title}</span>
                    {v.note && <Badge>{v.note}</Badge>}
                    {i === 0 && <Badge tone="emerald">Terbaru</Badge>}
                    <span className="text-xs text-slate-500">
                      {v.author.name} · {fmtDateTime(v.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => void restoreVersion(v.id)}
                      className="ml-auto text-xs font-medium text-emerald-700 hover:underline"
                    >
                      Pulihkan
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : (
        <form onSubmit={saveArticle} className="space-y-6">
          <Card>
            <div className="space-y-4">
              <Input label="Judul" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
              <div className="grid gap-4 sm:grid-cols-3">
                <Select label="Template" value={editTemplateId} onChange={(e) => setEditTemplateId(e.target.value)}>
                  <option value="">— Tanpa template —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.isBuiltIn ? " (Bawaan)" : ""}
                    </option>
                  ))}
                </Select>
                <Select label="Kategori" value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)}>
                  <option value="">— Tanpa kategori —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
                <Select label="Status" value={editStatus} onChange={(e) => setEditStatus(e.target.value as Status)}>
                  <option value="DRAFT">Draf</option>
                  <option value="PUBLISHED">Terbit</option>
                  <option value="PRIVATE">Pribadi</option>
                </Select>
              </div>
            </div>
          </Card>

          {editTemplateFields.length > 0 && (
            <Card>
              <h2 className="mb-4 text-base font-semibold text-slate-900">Field template</h2>
              <TemplateFieldsForm
                fields={editTemplateFields}
                values={editFieldValues}
                onChange={(key, value) => setEditFieldValues((prev) => ({ ...prev, [key]: value }))}
                articles={allArticles}
              />
            </Card>
          )}

          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">Isi (Markdown)</h2>
              <Button type="button" variant="secondary" onClick={() => setShowPreview((v) => !v)}>
                {showPreview ? "Tampilkan editor" : "Pratinjau"}
              </Button>
            </div>
            {showPreview ? (
              <div
                className="prose prose-slate max-w-none rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-800 [&_a]:text-emerald-700 [&_a]:underline"
                dangerouslySetInnerHTML={{
                  __html: renderWikiLinks(renderMarkdown(editContent), wikiMap),
                }}
              />
            ) : (
              <Textarea
                rows={16}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Tulis isi artikel dengan Markdown. Tautkan artikel lain dengan [[Judul Artikel]]."
                className="font-mono"
              />
            )}
            <p className="mt-2 text-xs text-slate-500">
              Tautan wiki: tulis [[Judul Artikel]] untuk menaut ke artikel lain di world ini.
            </p>
          </Card>

          <Card>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Saran auto-linking</h2>
            <p className="mb-3 text-sm text-slate-600">
              Periksa apakah ada nama artikel lain di world ini yang muncul di teks tapi belum ditautkan.
            </p>
            <Button type="button" variant="secondary" onClick={() => void checkLinks()} disabled={checkingLinks}>
              {checkingLinks ? "Memeriksa…" : "Periksa tautan"}
            </Button>
            {suggestions !== null && (
              <div className="mt-4 space-y-2">
                {suggestions.length === 0 ? (
                  <p className="text-sm text-slate-500">Tidak ada saran tautan — semua nama sudah tertaut atau tidak muncul di teks.</p>
                ) : (
                  <>
                    {suggestions.map((s) => (
                      <label key={s.entityId} className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={selectedSuggestions.includes(s.title)}
                          onChange={(e) =>
                            setSelectedSuggestions((prev) =>
                              e.target.checked ? [...prev, s.title] : prev.filter((t) => t !== s.title),
                            )
                          }
                        />
                        <span>
                          <span className="font-medium text-slate-800">[[{s.title}]]</span>
                          <span className="block text-xs text-slate-500">…{s.context}…</span>
                        </span>
                      </label>
                    ))}
                    <Button
                      type="button"
                      onClick={() => void applyLinks()}
                      disabled={applyingLinks || selectedSuggestions.length === 0}
                    >
                      {applyingLinks ? "Menerapkan…" : `Terima yang dipilih (${selectedSuggestions.length})`}
                    </Button>
                  </>
                )}
              </div>
            )}
          </Card>

          {saveError && <p className="text-sm text-red-700">{saveError}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
            <span className="text-sm text-slate-500">
              {saving ? "Menyimpan…" : savedAt ? `Tersimpan ${savedAt}` : `Terakhir diubah ${fmtDate(article.updatedAt)}`}
            </span>
          </div>
        </form>
      )}
    </div>
  );
}

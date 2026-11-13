"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { slugify } from "@/lib/slug";
import type { TemplateFieldDef } from "@/lib/seed-data";

type FieldType = TemplateFieldDef["type"];

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Teks pendek" },
  { value: "longtext", label: "Teks panjang" },
  { value: "number", label: "Angka" },
  { value: "date", label: "Tanggal" },
  { value: "dropdown", label: "Pilihan (dropdown)" },
  { value: "multiselect", label: "Pilihan ganda" },
  { value: "checkbox", label: "Centang (ya/tidak)" },
  { value: "image", label: "Gambar (URL / ID media)" },
  { value: "url", label: "Tautan (URL)" },
  { value: "entity", label: "Entitas (artikel lain)" },
  { value: "repeater", label: "Daftar (satu per baris)" },
];

type TemplateItem = {
  id: string;
  worldId: string | null;
  name: string;
  description: string | null;
  fields: TemplateFieldDef[];
  isBuiltIn: boolean;
  articleCount: number;
  createdAt: string;
};

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = (await res.json()) as ApiResult<T>;
  if (!res.ok || !json.ok) throw new Error(!json.ok ? json.error : `Gagal memuat (${res.status})`);
  return json.data;
}

type BuilderField = {
  label: string;
  type: FieldType;
  required: boolean;
  optionsText: string;
};

const emptyBuilderField = (): BuilderField => ({ label: "", type: "text", required: false, optionsText: "" });

/** Key field dibuat dari label; pastikan unik di dalam template. */
function buildFields(builder: BuilderField[]): TemplateFieldDef[] {
  const seen = new Set<string>();
  return builder
    .filter((f) => f.label.trim() !== "")
    .map((f, i) => {
      let key = slugify(f.label.trim()) || `field-${i + 1}`;
      let n = 2;
      while (seen.has(key)) {
        key = `${slugify(f.label.trim()) || `field-${i + 1}`}-${n}`;
        n++;
      }
      seen.add(key);
      const field: TemplateFieldDef = {
        key,
        label: f.label.trim(),
        type: f.type,
        required: f.required,
        order: i + 1,
      };
      if (f.type === "dropdown" || f.type === "multiselect") {
        field.options = f.optionsText.split(",").map((o) => o.trim()).filter(Boolean);
      }
      return field;
    });
}

export default function TemplatesPage() {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const worldId = params.worldId as string;
  const base = `/w/${workspaceId}/worlds/${worldId}`;

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [builder, setBuilder] = useState<BuilderField[]>([emptyBuilderField()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<TemplateItem[]>(`/api/templates?worldId=${worldId}`);
      setTemplates(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat template");
    } finally {
      setLoading(false);
    }
  }, [worldId]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setBuilder([emptyBuilderField()]);
    setFormError("");
  }

  function startEdit(t: TemplateItem) {
    setEditingId(t.id);
    setName(t.name);
    setDescription(t.description ?? "");
    setBuilder(
      [...t.fields]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((f) => ({
          label: f.label,
          type: f.type,
          required: f.required ?? false,
          optionsText: (f.options ?? []).join(", "),
        })),
    );
    setFormError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function moveField(index: number, dir: -1 | 1) {
    setBuilder((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const [moved] = next.splice(index, 1);
      if (moved) next.splice(target, 0, moved);
      return next;
    });
  }

  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setNotice("");
    if (!name.trim()) {
      setFormError("Nama template wajib diisi");
      return;
    }
    const fields = buildFields(builder);
    if (fields.length === 0) {
      setFormError("Tambahkan minimal satu field dengan label terisi");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const updated = await api<TemplateItem>(`/api/templates/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), description: description.trim(), fields }),
        });
        setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        setNotice(`Template "${updated.name}" berhasil diubah.`);
      } else {
        const created = await api<TemplateItem>("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ worldId, name: name.trim(), description: description.trim(), fields }),
        });
        setTemplates((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        setNotice(`Template "${created.name}" berhasil dibuat.`);
      }
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Gagal menyimpan template");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(t: TemplateItem) {
    if (!window.confirm(`Hapus template "${t.name}"?`)) return;
    try {
      await api(`/api/templates/${t.id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
      setNotice(`Template "${t.name}" dihapus.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus template");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title="Template"
        desc="Template bawaan (26 template dari brief) dan template kustom milik world ini. Template bawaan tidak bisa diedit atau dihapus."
        actions={<Button href={`${base}/articles`} variant="secondary">← Artikel</Button>}
      />
      {notice && <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>}
      {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

      <Card className="mb-6">
        <form onSubmit={saveTemplate} className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900">
            {editingId ? "Edit template kustom" : "Buat template kustom"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nama template" value={name} onChange={(e) => setName(e.target.value)} placeholder="cth. Karakter Sampingan" required />
            <Input label="Deskripsi (opsional)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Template ini untuk…" />
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700">Field template</span>
            <div className="space-y-3">
              {builder.map((f, i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_180px_110px_auto]">
                    <Input
                      label="Label"
                      value={f.label}
                      onChange={(e) =>
                        setBuilder((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                      }
                      placeholder="cth. Nama Lengkap"
                    />
                    <Select
                      label="Tipe"
                      value={f.type}
                      onChange={(e) =>
                        setBuilder((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, type: e.target.value as FieldType } : x)),
                        )
                      }
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                    <div>
                      <span className="mb-1 block text-sm font-medium text-slate-700">Wajib</span>
                      <label className="flex h-[38px] items-center gap-2 text-sm text-slate-800">
                        <input
                          type="checkbox"
                          checked={f.required}
                          onChange={(e) =>
                            setBuilder((prev) =>
                              prev.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)),
                            )
                          }
                        />
                        Ya
                      </label>
                    </div>
                    <div className="flex items-end gap-1">
                      <Button type="button" variant="secondary" onClick={() => moveField(i, -1)} disabled={i === 0}>
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => moveField(i, 1)}
                        disabled={i === builder.length - 1}
                      >
                        ↓
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => setBuilder((prev) => prev.filter((_, j) => j !== i))}
                        disabled={builder.length === 1}
                      >
                        Hapus
                      </Button>
                    </div>
                  </div>
                  {(f.type === "dropdown" || f.type === "multiselect") && (
                    <div className="mt-3">
                      <Input
                        label="Opsi (pisahkan dengan koma)"
                        value={f.optionsText}
                        onChange={(e) =>
                          setBuilder((prev) =>
                            prev.map((x, j) => (j === i ? { ...x, optionsText: e.target.value } : x)),
                          )
                        }
                        placeholder="cth. Perempuan, Laki-laki, Non-biner"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="secondary" onClick={() => setBuilder((prev) => [...prev, emptyBuilderField()])} className="mt-3">
              + Tambah field
            </Button>
          </div>

          {formError && <p className="text-sm text-red-700">{formError}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan…" : editingId ? "Simpan perubahan" : "Buat template"}
            </Button>
            {editingId && (
              <Button type="button" variant="secondary" onClick={resetForm}>
                Batal edit
              </Button>
            )}
          </div>
        </form>
      </Card>

      {loading ? (
        <p className="text-sm text-slate-500">Memuat template…</p>
      ) : templates.length === 0 ? (
        <EmptyState title="Belum ada template" desc="Buat template kustom pertamamu di atas." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{t.name}</p>
                  {t.description && <p className="mt-1 text-sm text-slate-600">{t.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{t.fields.length} field</span>
                    <span>·</span>
                    <span>Dipakai {t.articleCount} artikel</span>
                    {t.isBuiltIn && <Badge tone="amber">Bawaan</Badge>}
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {t.fields.map((f) => f.label).join(" · ")}
                  </p>
                </div>
                {!t.isBuiltIn && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="secondary" onClick={() => startEdit(t)}>
                      Edit
                    </Button>
                    <Button variant="danger" onClick={() => void deleteTemplate(t)}>
                      Hapus
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

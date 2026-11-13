/**
 * Auto-linking: deteksi nama entitas (judul artikel lain di world yang sama)
 * di dalam teks artikel, lalu tawarkan sebagai saran tautan [[Nama]].
 * Saran tidak diterapkan otomatis — pengguna menerima / memilih / mengabaikan.
 */

export type EntityRef = { id: string; title: string; slug: string };

export type LinkSuggestion = {
  entityId: string;
  title: string;
  slug: string;
  /** posisi kemunculan pertama (offset karakter) */
  index: number;
  /** potongan konteks di sekitar kemunculan */
  context: string;
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Apakah teks sudah mengandung tautan [[Judul]] untuk entitas ini? */
export function alreadyLinked(content: string, title: string): boolean {
  return content.includes(`[[${title}]]`);
}

export function suggestLinks(content: string, entities: EntityRef[]): LinkSuggestion[] {
  const out: LinkSuggestion[] = [];
  for (const e of entities) {
    if (!e.title || e.title.length < 2) continue;
    if (alreadyLinked(content, e.title)) continue;
    const re = new RegExp(`\\b${escapeRegExp(e.title)}\\b`, "i");
    const m = re.exec(content);
    if (!m) continue;
    const start = Math.max(0, m.index - 40);
    const end = Math.min(content.length, m.index + e.title.length + 40);
    out.push({
      entityId: e.id,
      title: e.title,
      slug: e.slug,
      index: m.index,
      context: content.slice(start, end).replace(/\n/g, " "),
    });
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

/**
 * Terapkan saran yang diterima: ganti kemunculan pertama tiap judul
 * (yang belum tertaut) menjadi [[Judul]]. Satu pass agar tidak saling menimpa.
 */
export function applySuggestions(content: string, accepted: { title: string }[]): string {
  let out = content;
  for (const a of accepted) {
    if (alreadyLinked(out, a.title)) continue;
    const re = new RegExp(`\\b${escapeRegExp(a.title)}\\b`, "i");
    out = out.replace(re, `[[${a.title}]]`);
  }
  return out;
}

/** Ekstrak semua tautan [[Judul]] dari konten. */
export function extractLinks(content: string): string[] {
  const found = new Set<string>();
  const re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) found.add(m[1].trim());
  return [...found];
}

/** Ubah [[Judul]] menjadi tautan HTML ke halaman artikel (dipakai saat render). */
export function renderWikiLinks(html: string, byTitle: Map<string, string>): string {
  return html.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, title: string, label?: string) => {
    const href = byTitle.get(title.trim());
    const text = (label ?? title).trim();
    if (!href) return text;
    return `<a href="${href}">${text}</a>`;
  });
}

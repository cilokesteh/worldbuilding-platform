import { marked } from "marked";

/**
 * Render Markdown menjadi HTML yang aman untuk ditampilkan.
 * marked sendiri tidak meng-escape HTML mentah; kita bersihkan dulu:
 * - hapus <script>/<style>/<iframe>/<object>/<embed>/<form> beserta isinya
 * - hapus event handler (on*) dan javascript:/data:text/html: di atribut
 * - hanya izinkan tag/format yang dipakai editor (p, h1-h6, ul/ol/li, a,
 *   strong, em, code, pre, blockquote, table, img, hr, br, del, sup, sub)
 */
const ALLOWED_TAGS = new Set([
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "a", "strong", "em", "code", "pre",
  "blockquote", "table", "thead", "tbody", "tr", "th", "td",
  "img", "hr", "br", "del", "sup", "sub", "span",
]);

export function sanitizeHtml(html: string): string {
  let out = html.replace(/<(script|style|iframe|object|embed|form|link|meta|base)[\s\S]*?<\/\1\s*>/gi, "");
  out = out.replace(/<(script|style|iframe|object|embed|form|link|meta|base)[^>]*\/?>/gi, "");
  // Hapus event handler on*="..."
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Hapus href/src javascript: dan data:text/html:
  out = out.replace(/\s+(href|src)\s*=\s*("|\')\s*(javascript:|data:text\/html:)[^"']*\2/gi, ' $1="#"');
  // Hanya izinkan tag yang dikenal; tag lain di-escape
  out = out.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, (m, tag: string, attrs: string) => {
    const t = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(t)) return m.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (m.startsWith("</")) return `</${t}>`;
    // Untuk <a> dan <img> hanya pertahankan atribut aman
    if (t === "a") {
      const href = attrs.match(/href\s*=\s*("[^"]*"|'[^']*')/i)?.[1] ?? '""';
      return `<a href=${href} rel="noopener noreferrer">`;
    }
    if (t === "img") {
      const src = attrs.match(/src\s*=\s*("[^"]*"|'[^']*')/i)?.[1] ?? '""';
      const alt = attrs.match(/alt\s*=\s*("[^"]*"|'[^']*')/i)?.[1] ?? '""';
      return `<img src=${src} alt=${alt} />`;
    }
    return `<${t}>`;
  });
  return out;
}

export function renderMarkdown(md: string): string {
  const raw = marked.parse(md || "", { breaks: true }) as string;
  return sanitizeHtml(raw);
}

/** Hitung jumlah kata dari teks Markdown (strip sintaks). */
export function wordCount(md: string): number {
  const text = (md || "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/[#>*`_\-|[\]()!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.split(" ").length : 0;
}

export function excerptOf(md: string, len = 160): string {
  const text = (md || "")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/[#>*`_\-|[\]()!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > len ? text.slice(0, len) + "…" : text;
}

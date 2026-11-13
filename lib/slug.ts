export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "artikel";
}

export function uniqueSlug(base: string, taken: Set<string>): string {
  let s = base;
  let i = 2;
  while (taken.has(s)) {
    s = `${base}-${i}`;
    i++;
  }
  return s;
}

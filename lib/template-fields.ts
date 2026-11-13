import type { TemplateFieldDef } from "@/lib/seed-data";

export const FIELD_TYPES = [
  "text",
  "longtext",
  "number",
  "date",
  "dropdown",
  "multiselect",
  "checkbox",
  "image",
  "url",
  "entity",
  "repeater",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

/** Validasi + normalisasi array fields template. */
export function validateFields(input: unknown): { ok: true; fields: TemplateFieldDef[] } | { ok: false; error: string } {
  if (!Array.isArray(input)) return { ok: false, error: "fields harus berupa array" };
  const seen = new Set<string>();
  const fields: TemplateFieldDef[] = [];
  for (let i = 0; i < input.length; i++) {
    const raw = input[i] as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") return { ok: false, error: `Field ke-${i + 1} tidak valid` };
    const key = typeof raw.key === "string" ? raw.key.trim() : "";
    const label = typeof raw.label === "string" ? raw.label.trim() : "";
    const type = typeof raw.type === "string" ? raw.type : "";
    if (!key) return { ok: false, error: `Field ke-${i + 1}: key wajib diisi` };
    if (seen.has(key)) return { ok: false, error: `Field ke-${i + 1}: key "${key}" duplikat` };
    seen.add(key);
    if (!label) return { ok: false, error: `Field ke-${i + 1}: label wajib diisi` };
    if (!(FIELD_TYPES as readonly string[]).includes(type)) {
      return { ok: false, error: `Field ke-${i + 1}: type "${type}" tidak dikenal` };
    }
    const field: TemplateFieldDef = {
      key,
      label,
      type: type as FieldType,
      required: raw.required === true,
      order: typeof raw.order === "number" && Number.isFinite(raw.order) ? raw.order : i + 1,
    };
    if (Array.isArray(raw.options)) {
      field.options = raw.options.filter((o): o is string => typeof o === "string" && o.trim() !== "").map((o) => o.trim());
    }
    if (typeof raw.prompt === "string" && raw.prompt.trim() !== "") field.prompt = raw.prompt.trim();
    fields.push(field);
  }
  return { ok: true, fields };
}

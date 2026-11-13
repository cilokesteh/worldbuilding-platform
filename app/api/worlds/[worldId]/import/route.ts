import { NextRequest, NextResponse } from "next/server";
import { Prisma, type ArticleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ROLE_RANK, getMemberRole } from "@/lib/permissions";
import { slugify, uniqueSlug } from "@/lib/slug";
import { excerptOf, wordCount } from "@/lib/markdown";
import { EXPORT_FORMAT } from "@/lib/export-format";

function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

const VALID_STATUSES: ArticleStatus[] = ["DRAFT", "PUBLISHED", "PRIVATE"];

type ExportArticle = {
  id?: unknown;
  title?: unknown;
  slug?: unknown;
  templateName?: unknown;
  categoryName?: unknown;
  content?: unknown;
  fieldValues?: unknown;
  excerpt?: unknown;
  status?: unknown;
  createdById?: unknown;
};

type ExportData = {
  world?: { name?: unknown; description?: unknown; genre?: unknown; tags?: unknown; isPublic?: unknown };
  categories?: unknown;
  templates?: unknown;
  articles?: unknown;
  relationships?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/**
 * POST /api/worlds/[worldId]/import — impor JSON hasil export sebagai world BARU.
 * Body: { workspaceId?, data }. Butuh EDITOR+ di workspace tujuan.
 * [worldId] pada path tidak dipakai sebagai target — world baru selalu dibuat.
 * Menolak file yang bukan format export (400).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string }> },
) {
  await params; // segmen path ada demi konsistensi URL, target diambil dari body
  const user = await getSessionUser();
  if (!user) return fail("Harus login terlebih dahulu.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Body harus JSON: { workspaceId, data }.", 400);
  }
  if (!isRecord(body)) return fail("Body harus JSON: { workspaceId, data }.", 400);

  const data: unknown = body.data;
  if (!isRecord(data)) {
    return fail("File bukan format export: field \"data\" tidak ditemukan.", 400);
  }
  if (data.format !== undefined && data.format !== EXPORT_FORMAT) {
    return fail(
      `File bukan format export platform ini (format: ${String(data.format)}).`,
      400,
    );
  }
  const exp = data as unknown as ExportData;
  const worldName = asString(exp.world?.name);
  if (!worldName) {
    return fail("File bukan format export: nama world tidak ditemukan.", 400);
  }
  if (!Array.isArray(exp.articles)) {
    return fail("File bukan format export: daftar artikel tidak ditemukan.", 400);
  }

  // Workspace tujuan: dari body, atau workspace pertama milik user.
  let workspaceId = asString(body.workspaceId);
  if (!workspaceId) {
    const owned = await prisma.workspace.findFirst({
      where: { ownerId: user.userId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    const member = owned ??
      (await prisma.workspaceMember.findFirst({
        where: { userId: user.userId },
        orderBy: { createdAt: "asc" },
        select: { workspaceId: true },
      }));
    workspaceId = owned ? owned.id : (member as { workspaceId: string } | null)?.workspaceId ?? null;
  }
  if (!workspaceId) {
    return fail("Workspace tujuan tidak ditemukan. Buat workspace dulu.", 400);
  }
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });
  if (!workspace) return fail("Workspace tujuan tidak ditemukan.", 404);
  const role = await getMemberRole(workspaceId, user.userId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.EDITOR) {
    return fail("Impor butuh peran Editor atau lebih tinggi di workspace tujuan.", 403);
  }

  const categories = Array.isArray(exp.categories) ? exp.categories : [];
  const templates = Array.isArray(exp.templates) ? exp.templates : [];
  const articles = exp.articles as ExportArticle[];
  const relationships = Array.isArray(exp.relationships) ? exp.relationships : [];

  const takenSlugs = new Set<string>();
  const categoryByName = new Map<string, string>();
  const templateByName = new Map<string, string>();
  const articleByOldId = new Map<string, string>();

  let categoriesCount = 0;
  let templatesCount = 0;
  let articlesCount = 0;
  let relationshipsCount = 0;

  const world = await prisma.world.create({
    data: {
      workspaceId,
      name: `${worldName} (Impor)`,
      description: asString(exp.world?.description),
      genre: asString(exp.world?.genre),
      tags: asStringArray(exp.world?.tags),
      isPublic: exp.world?.isPublic === true,
    },
  });

  // Kategori (nama unik per world).
  for (const c of categories) {
    if (!isRecord(c)) continue;
    const name = asString(c.name);
    if (!name || categoryByName.has(name)) continue;
    const created = await prisma.category.create({
      data: {
        worldId: world.id,
        name,
        color: asString(c.color),
      },
    });
    categoryByName.set(name, created.id);
    categoriesCount++;
  }

  // Template khusus-world dibuat ulang; template bawaan dipetakan berdasarkan nama.
  for (const t of templates) {
    if (!isRecord(t)) continue;
    const name = asString(t.name);
    if (!name || templateByName.has(name)) continue;
    if (t.isBuiltIn === true) {
      const builtin = await prisma.template.findFirst({
        where: { worldId: null, name },
        select: { id: true },
      });
      if (builtin) {
        templateByName.set(name, builtin.id);
        continue;
      }
    }
    const created = await prisma.template.create({
      data: {
        worldId: world.id,
        name,
        description: asString(t.description),
        fields: (Array.isArray(t.fields) ? t.fields : []) as Prisma.InputJsonValue,
        isBuiltIn: false,
      },
    });
    templateByName.set(name, created.id);
    templatesCount++;
  }

  // Artikel (slug dibuat unik di world baru).
  for (const a of articles) {
    if (!isRecord(a)) continue;
    const title = asString(a.title);
    if (!title) continue;
    const content = typeof a.content === "string" ? a.content : "";
    const status: ArticleStatus =
      typeof a.status === "string" &&
      (VALID_STATUSES as string[]).includes(a.status)
        ? (a.status as ArticleStatus)
        : "DRAFT";
    const base = slugify(asString(a.slug) ?? title);
    const slug = uniqueSlug(base, takenSlugs);
    takenSlugs.add(slug);
    const templateId = asString(a.templateName)
      ? templateByName.get(asString(a.templateName) as string) ?? null
      : null;
    const categoryId = asString(a.categoryName)
      ? categoryByName.get(asString(a.categoryName) as string) ?? null
      : null;
    const created = await prisma.article.create({
      data: {
        worldId: world.id,
        templateId,
        categoryId,
        title,
        slug,
        content,
        fieldValues: (isRecord(a.fieldValues) ? a.fieldValues : {}) as Prisma.InputJsonValue,
        excerpt: asString(a.excerpt) ?? excerptOf(content) ?? null,
        status,
        wordCount: wordCount(content),
        createdById: user.userId,
      },
    });
    if (typeof a.id === "string") articleByOldId.set(a.id, created.id);
    // Relasi diekspor dengan id artikel lama; simpan juga pemetaan via judul+slug.
    articleByOldId.set(`title:${title}`, created.id);
    articlesCount++;
  }

  // Relasi di-remap ke id artikel baru.
  for (const r of relationships) {
    if (!isRecord(r)) continue;
    const from = asString(r.fromArticleId);
    const to = asString(r.toArticleId);
    const type = asString(r.type);
    if (!from || !to || !type) continue;
    const fromId = articleByOldId.get(from);
    const toId = articleByOldId.get(to);
    if (!fromId || !toId) continue;
    try {
      await prisma.relationship.create({
        data: {
          worldId: world.id,
          fromArticleId: fromId,
          toArticleId: toId,
          type,
          label: asString(r.label),
        },
      });
      relationshipsCount++;
    } catch {
      // Relasi duplikat (from, to, type) — lewati.
    }
  }

  return ok(
    {
      world: { id: world.id, name: world.name },
      imported: {
        categories: categoriesCount,
        templates: templatesCount,
        articles: articlesCount,
        relationships: relationshipsCount,
      },
    },
    201,
  );
}

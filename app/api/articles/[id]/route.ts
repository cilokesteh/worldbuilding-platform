import { NextRequest, NextResponse } from "next/server";
import { ArticleStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getMemberRole, ROLE_RANK } from "@/lib/permissions";
import { excerptOf, wordCount } from "@/lib/markdown";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function succeed(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const b: unknown = await req.json();
    if (b && typeof b === "object" && !Array.isArray(b)) return b as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}

const STATUSES: ArticleStatus[] = ["DRAFT", "PUBLISHED", "PRIVATE"];
const MAX_VERSIONS = 20;

/** Hapus versi lama, sisakan 20 versi terakhir. */
async function pruneVersions(articleId: string) {
  const versions = await prisma.articleVersion.findMany({
    where: { articleId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (versions.length > MAX_VERSIONS) {
    const excess = versions.slice(0, versions.length - MAX_VERSIONS).map((v) => v.id);
    await prisma.articleVersion.deleteMany({ where: { id: { in: excess } } });
  }
}

type Ctx = { params: Promise<{ id: string }> };

async function loadArticle(id: string) {
  return prisma.article.findUnique({
    where: { id },
    include: {
      world: { select: { workspaceId: true, id: true } },
      template: { select: { id: true, name: true, fields: true } },
      category: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
      _count: { select: { versions: true, comments: true } },
    },
  });
}

/** GET /api/articles/[id] — anggota world. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { id } = await params;
  const article = await loadArticle(id);
  if (!article) return fail("Artikel tidak ditemukan", 404);
  const role = await getMemberRole(article.world.workspaceId, user.userId);
  if (!role) return fail("Bukan anggota workspace ini", 403);
  const comments = await prisma.comment.findMany({
    where: { articleId: id },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true } } },
  });
  return succeed({
    id: article.id,
    worldId: article.worldId,
    templateId: article.templateId,
    categoryId: article.categoryId,
    title: article.title,
    slug: article.slug,
    content: article.content,
    fieldValues: (article.fieldValues ?? {}) as Record<string, unknown>,
    excerpt: article.excerpt,
    status: article.status,
    wordCount: article.wordCount,
    createdById: article.createdById,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    template: article.template
      ? { id: article.template.id, name: article.template.name, fields: article.template.fields }
      : null,
    category: article.category,
    author: article.author,
    versionCount: article._count.versions,
    commentCount: article._count.comments,
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      user: c.user,
    })),
  });
}

/**
 * PATCH /api/articles/[id] — EDITOR+, atau CONTRIBUTOR+ kalau dia pembuat artikel.
 * Setiap perubahan title/content/fieldValues membuat ArticleVersion baru.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { id } = await params;
  const article = await loadArticle(id);
  if (!article) return fail("Artikel tidak ditemukan", 404);
  const role = await getMemberRole(article.world.workspaceId, user.userId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.CONTRIBUTOR) {
    return fail("Butuh peran Kontributor atau lebih tinggi", 403);
  }
  const isAuthor = article.createdById === user.userId;
  if (ROLE_RANK[role] < ROLE_RANK.EDITOR && !isAuthor) {
    return fail("Hanya Editor atau pembuat artikel yang boleh mengubah artikel ini", 403);
  }

  const body = await readBody(req);
  const data: Prisma.ArticleUpdateInput = {};
  let nextTitle = article.title;
  let nextContent = article.content;
  let nextFieldValues = (article.fieldValues ?? {}) as Record<string, unknown>;
  let changed = false;

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) return fail("Judul artikel tidak boleh kosong", 400);
    if (title !== article.title) changed = true;
    nextTitle = title;
    data.title = title;
  }
  if (typeof body.content === "string") {
    if (body.content !== article.content) changed = true;
    nextContent = body.content;
    data.content = body.content;
    data.wordCount = wordCount(body.content);
    data.excerpt = excerptOf(body.content);
  }
  if (body.fieldValues !== undefined) {
    if (body.fieldValues && typeof body.fieldValues === "object" && !Array.isArray(body.fieldValues)) {
      const fv = body.fieldValues as Record<string, unknown>;
      if (JSON.stringify(fv) !== JSON.stringify(nextFieldValues)) changed = true;
      nextFieldValues = fv;
      data.fieldValues = fv as unknown as Prisma.InputJsonValue;
    } else {
      return fail("fieldValues harus berupa object", 400);
    }
  }
  if (typeof body.status === "string") {
    if (!(STATUSES as string[]).includes(body.status)) return fail("Status tidak dikenal", 400);
    data.status = body.status as ArticleStatus;
  }
  if (body.categoryId !== undefined) {
    const categoryId = typeof body.categoryId === "string" && body.categoryId !== "" ? body.categoryId : null;
    if (categoryId) {
      const c = await prisma.category.findFirst({
        where: { id: categoryId, worldId: article.worldId },
        select: { id: true },
      });
      if (!c) return fail("Kategori tidak ditemukan di world ini", 400);
    }
    data.category = categoryId ? { connect: { id: categoryId } } : { disconnect: true };
  }
  if (body.templateId !== undefined) {
    const templateId = typeof body.templateId === "string" && body.templateId !== "" ? body.templateId : null;
    if (templateId) {
      const t = await prisma.template.findFirst({
        where: { id: templateId, OR: [{ worldId: article.worldId }, { worldId: null, isBuiltIn: true }] },
        select: { id: true },
      });
      if (!t) return fail("Template tidak ditemukan di world ini", 400);
    }
    data.template = templateId ? { connect: { id: templateId } } : { disconnect: true };
  }

  const updated = await prisma.article.update({
    where: { id },
    data,
    include: {
      template: { select: { id: true, name: true, fields: true } },
      category: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
      _count: { select: { versions: true, comments: true } },
    },
  });

  if (changed) {
    await prisma.articleVersion.create({
      data: {
        articleId: id,
        title: nextTitle,
        content: nextContent,
        fieldValues: nextFieldValues as unknown as Prisma.InputJsonValue,
        note: "Diubah",
        createdById: user.userId,
      },
    });
    await pruneVersions(id);
  }

  return succeed({
    id: updated.id,
    worldId: updated.worldId,
    templateId: updated.templateId,
    categoryId: updated.categoryId,
    title: updated.title,
    slug: updated.slug,
    content: updated.content,
    fieldValues: (updated.fieldValues ?? {}) as Record<string, unknown>,
    excerpt: updated.excerpt,
    status: updated.status,
    wordCount: updated.wordCount,
    createdById: updated.createdById,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    template: updated.template
      ? { id: updated.template.id, name: updated.template.name, fields: updated.template.fields }
      : null,
    category: updated.category,
    author: updated.author,
    versionCount: updated._count.versions + (changed ? 1 : 0),
    commentCount: updated._count.comments,
  });
}

/** DELETE /api/articles/[id] — EDITOR+. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { id } = await params;
  const article = await loadArticle(id);
  if (!article) return fail("Artikel tidak ditemukan", 404);
  const role = await getMemberRole(article.world.workspaceId, user.userId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.EDITOR) return fail("Butuh peran Editor atau lebih tinggi", 403);
  await prisma.article.delete({ where: { id } });
  return succeed({ deleted: true, id });
}

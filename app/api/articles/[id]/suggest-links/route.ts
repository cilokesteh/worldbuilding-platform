import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getMemberRole, ROLE_RANK } from "@/lib/permissions";
import { excerptOf, wordCount } from "@/lib/markdown";
import { applySuggestions, suggestLinks } from "@/lib/autolink";

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

const MAX_VERSIONS = 20;

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
    include: { world: { select: { workspaceId: true } } },
  });
}

/** GET /api/articles/[id]/suggest-links — saran auto-link dari artikel lain se-world. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { id } = await params;
  const article = await loadArticle(id);
  if (!article) return fail("Artikel tidak ditemukan", 404);
  const role = await getMemberRole(article.world.workspaceId, user.userId);
  if (!role) return fail("Bukan anggota workspace ini", 403);
  const others = await prisma.article.findMany({
    where: { worldId: article.worldId, id: { not: id } },
    select: { id: true, title: true, slug: true },
    orderBy: { title: "asc" },
  });
  return succeed(suggestLinks(article.content, others));
}

/**
 * POST /api/articles/[id]/suggest-links { acceptedTitles: string[] }
 * Terapkan saran yang dipilih ke konten artikel (EDITOR+), simpan + buat versi baru.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { id } = await params;
  const article = await loadArticle(id);
  if (!article) return fail("Artikel tidak ditemukan", 404);
  const role = await getMemberRole(article.world.workspaceId, user.userId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.EDITOR) return fail("Butuh peran Editor atau lebih tinggi", 403);
  const body = await readBody(req);
  if (!Array.isArray(body.acceptedTitles)) return fail("acceptedTitles harus berupa array string", 400);
  const acceptedTitles = body.acceptedTitles.filter(
    (t): t is string => typeof t === "string" && t.trim() !== "",
  );
  if (acceptedTitles.length === 0) return fail("Tidak ada saran yang dipilih", 400);

  const nextContent = applySuggestions(
    article.content,
    acceptedTitles.map((title) => ({ title })),
  );
  if (nextContent === article.content) {
    return succeed({ articleId: id, applied: 0, content: article.content, changed: false });
  }
  const fieldValues = (article.fieldValues ?? {}) as Record<string, unknown>;
  const updated = await prisma.article.update({
    where: { id },
    data: {
      content: nextContent,
      wordCount: wordCount(nextContent),
      excerpt: excerptOf(nextContent),
    },
  });
  await prisma.articleVersion.create({
    data: {
      articleId: id,
      title: article.title,
      content: nextContent,
      fieldValues: fieldValues as unknown as Prisma.InputJsonValue,
      note: "Tautan otomatis diterapkan",
      createdById: user.userId,
    },
  });
  await pruneVersions(id);
  return succeed({
    articleId: id,
    applied: acceptedTitles.length,
    content: updated.content,
    wordCount: updated.wordCount,
    excerpt: updated.excerpt,
    updatedAt: updated.updatedAt,
    changed: true,
  });
}

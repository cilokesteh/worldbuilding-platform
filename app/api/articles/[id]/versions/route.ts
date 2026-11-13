import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

/** GET /api/articles/[id]/versions — daftar versi, terbaru dulu. Anggota world. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { id } = await params;
  const article = await loadArticle(id);
  if (!article) return fail("Artikel tidak ditemukan", 404);
  const role = await getMemberRole(article.world.workspaceId, user.userId);
  if (!role) return fail("Bukan anggota workspace ini", 403);
  const versions = await prisma.articleVersion.findMany({
    where: { articleId: id },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { id: true, name: true } } },
  });
  return succeed(
    versions.map((v) => ({
      id: v.id,
      articleId: v.articleId,
      title: v.title,
      content: v.content,
      fieldValues: (v.fieldValues ?? {}) as Record<string, unknown>,
      note: v.note,
      createdById: v.createdById,
      createdAt: v.createdAt,
      author: v.author,
    })),
  );
}

/**
 * POST /api/articles/[id]/versions { versionId } — pulihkan versi.
 * Salin title/content/fieldValues ke artikel + buat versi baru. Butuh EDITOR+.
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
  const versionId = typeof body.versionId === "string" ? body.versionId : "";
  if (!versionId) return fail("versionId wajib diisi", 400);
  const version = await prisma.articleVersion.findFirst({
    where: { id: versionId, articleId: id },
  });
  if (!version) return fail("Versi tidak ditemukan", 404);

  const fieldValues = (version.fieldValues ?? {}) as Record<string, unknown>;
  const updated = await prisma.article.update({
    where: { id },
    data: {
      title: version.title,
      content: version.content,
      fieldValues: fieldValues as unknown as Prisma.InputJsonValue,
      wordCount: wordCount(version.content),
      excerpt: excerptOf(version.content),
    },
  });
  const restored = await prisma.articleVersion.create({
    data: {
      articleId: id,
      title: version.title,
      content: version.content,
      fieldValues: fieldValues as unknown as Prisma.InputJsonValue,
      note: `Dipulihkan dari versi ${version.createdAt.toLocaleString("id-ID")}`,
      createdById: user.userId,
    },
  });
  await pruneVersions(id);
  return succeed({
    article: {
      id: updated.id,
      title: updated.title,
      content: updated.content,
      fieldValues,
      wordCount: updated.wordCount,
      excerpt: updated.excerpt,
      updatedAt: updated.updatedAt,
    },
    version: { id: restored.id, note: restored.note, createdAt: restored.createdAt },
  });
}

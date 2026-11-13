import { NextRequest, NextResponse } from "next/server";
import { ArticleStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getMemberRole, getWorkspaceIdOfWorld, ROLE_RANK } from "@/lib/permissions";
import { excerptOf, wordCount } from "@/lib/markdown";
import { slugify, uniqueSlug } from "@/lib/slug";

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

function serializeArticle(a: {
  id: string;
  worldId: string;
  templateId: string | null;
  categoryId: string | null;
  title: string;
  slug: string;
  content: string;
  fieldValues: unknown;
  excerpt: string | null;
  status: ArticleStatus;
  wordCount: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  template?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
  author?: { id: string; name: string };
}) {
  return {
    id: a.id,
    worldId: a.worldId,
    templateId: a.templateId,
    categoryId: a.categoryId,
    title: a.title,
    slug: a.slug,
    content: a.content,
    fieldValues: (a.fieldValues ?? {}) as Record<string, unknown>,
    excerpt: a.excerpt,
    status: a.status,
    wordCount: a.wordCount,
    createdById: a.createdById,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    template: a.template ?? null,
    category: a.category ?? null,
    author: a.author ?? null,
  };
}

type Ctx = { params: Promise<{ worldId: string }> };

/**
 * GET /api/worlds/[worldId]/articles?q&status&categoryId&templateId
 * Anggota workspace saja.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { worldId } = await params;
  const workspaceId = await getWorkspaceIdOfWorld(worldId);
  if (!workspaceId) return fail("World tidak ditemukan", 404);
  const role = await getMemberRole(workspaceId, user.userId);
  if (!role) return fail("Bukan anggota workspace ini", 403);

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() || "";
  const status = sp.get("status") || "";
  const categoryId = sp.get("categoryId") || "";
  const templateId = sp.get("templateId") || "";

  const where: Prisma.ArticleWhereInput = { worldId };
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { content: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status && (STATUSES as string[]).includes(status)) where.status = status as ArticleStatus;
  if (categoryId) where.categoryId = categoryId;
  if (templateId) where.templateId = templateId;

  const articles = await prisma.article.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      template: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  });
  return succeed(articles.map(serializeArticle));
}

/** POST /api/worlds/[worldId]/articles — butuh CONTRIBUTOR+. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { worldId } = await params;
  const workspaceId = await getWorkspaceIdOfWorld(worldId);
  if (!workspaceId) return fail("World tidak ditemukan", 404);
  const role = await getMemberRole(workspaceId, user.userId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.CONTRIBUTOR) {
    return fail("Butuh peran Kontributor atau lebih tinggi", 403);
  }

  const body = await readBody(req);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return fail("Judul artikel wajib diisi", 400);
  const content = typeof body.content === "string" ? body.content : "";
  const templateId =
    typeof body.templateId === "string" && body.templateId !== "" ? body.templateId : null;
  const categoryId =
    typeof body.categoryId === "string" && body.categoryId !== "" ? body.categoryId : null;
  const fieldValues =
    body.fieldValues && typeof body.fieldValues === "object" && !Array.isArray(body.fieldValues)
      ? (body.fieldValues as Record<string, unknown>)
      : {};
  let status: ArticleStatus = "DRAFT";
  if (typeof body.status === "string" && (STATUSES as string[]).includes(body.status)) {
    status = body.status as ArticleStatus;
  }

  if (templateId) {
    const t = await prisma.template.findFirst({
      where: { id: templateId, OR: [{ worldId }, { worldId: null, isBuiltIn: true }] },
      select: { id: true },
    });
    if (!t) return fail("Template tidak ditemukan di world ini", 400);
  }
  if (categoryId) {
    const c = await prisma.category.findFirst({ where: { id: categoryId, worldId }, select: { id: true } });
    if (!c) return fail("Kategori tidak ditemukan di world ini", 400);
  }

  const existing = await prisma.article.findMany({ where: { worldId }, select: { slug: true } });
  const slug = uniqueSlug(slugify(title), new Set(existing.map((a) => a.slug)));

  const created = await prisma.article.create({
    data: {
      worldId,
      templateId,
      categoryId,
      title,
      slug,
      content,
      fieldValues: fieldValues as unknown as Prisma.InputJsonValue,
      excerpt: excerptOf(content),
      status,
      wordCount: wordCount(content),
      createdById: user.userId,
      versions: {
        create: {
          title,
          content,
          fieldValues: fieldValues as unknown as Prisma.InputJsonValue,
          note: "Dibuat",
          createdById: user.userId,
        },
      },
    },
    include: {
      template: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  });
  return succeed(serializeArticle(created), 201);
}

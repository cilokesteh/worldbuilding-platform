import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getMemberRole, ROLE_RANK } from "@/lib/permissions";

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

type Ctx = { params: Promise<{ id: string }> };

async function loadArticle(id: string) {
  return prisma.article.findUnique({
    where: { id },
    include: { world: { select: { workspaceId: true } } },
  });
}

/** GET /api/articles/[id]/comments — anggota world. */
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
  return succeed(
    comments.map((c) => ({
      id: c.id,
      articleId: c.articleId,
      body: c.body,
      createdAt: c.createdAt,
      user: c.user,
    })),
  );
}

/**
 * POST /api/articles/[id]/comments { body } — anggota workspace.
 * REVIEWER+ boleh komentar; VIEWER tidak.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { id } = await params;
  const article = await loadArticle(id);
  if (!article) return fail("Artikel tidak ditemukan", 404);
  const role = await getMemberRole(article.world.workspaceId, user.userId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.REVIEWER) {
    return fail("Hanya Reviewer ke atas yang boleh berkomentar", 403);
  }
  const body = await readBody(req);
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return fail("Isi komentar wajib diisi", 400);
  const created = await prisma.comment.create({
    data: { articleId: id, userId: user.userId, body: text },
    include: { user: { select: { id: true, name: true } } },
  });
  return succeed(
    {
      id: created.id,
      articleId: created.articleId,
      body: created.body,
      createdAt: created.createdAt,
      user: created.user,
    },
    201,
  );
}

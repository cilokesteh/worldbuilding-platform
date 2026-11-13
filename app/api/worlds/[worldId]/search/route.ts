import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getMemberRole, getWorkspaceIdOfWorld } from "@/lib/permissions";
import { excerptOf } from "@/lib/markdown";

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function succeed(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

type Ctx = { params: Promise<{ worldId: string }> };

/** Potongan konteks di sekitar kemunculan kata kunci pertama. */
function snippet(content: string, q: string, len = 160): string {
  const plain = (content || "").replace(/[#>*`_\-|[\]()!]/g, " ").replace(/\s+/g, " ").trim();
  const idx = plain.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return excerptOf(content, len);
  const start = Math.max(0, idx - 60);
  const end = Math.min(plain.length, idx + q.length + 100);
  const piece = plain.slice(start, end);
  return (start > 0 ? "…" : "") + piece + (end < plain.length ? "…" : "");
}

/**
 * GET /api/worlds/[worldId]/search?q=&categoryId=&tag=
 * Cari di title + content artikel world (contains, insensitive).
 * Anggota workspace saja.
 * Catatan: artikel tidak punya field tag; `tag` dipakai sebagai filter
 * tambahan "mengandung" pada title/content (mis. tag world yang disebut
 * di dalam artikel).
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
  const categoryId = sp.get("categoryId") || "";
  const tag = sp.get("tag")?.trim() || "";
  if (!q && !tag) return succeed([]);

  const where: Prisma.ArticleWhereInput = { worldId };
  const ors: Prisma.ArticleWhereInput[] = [];
  if (q) {
    ors.push(
      { title: { contains: q, mode: "insensitive" } },
      { content: { contains: q, mode: "insensitive" } },
    );
  }
  if (tag) {
    ors.push(
      { title: { contains: tag, mode: "insensitive" } },
      { content: { contains: tag, mode: "insensitive" } },
    );
  }
  if (ors.length > 0) where.OR = ors;
  if (categoryId) where.categoryId = categoryId;

  const articles = await prisma.article.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      template: { select: { id: true, name: true } },
      category: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  });
  const keyword = q || tag;
  return succeed(
    articles.map((a) => ({
      id: a.id,
      worldId: a.worldId,
      templateId: a.templateId,
      categoryId: a.categoryId,
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      snippet: snippet(a.content, keyword),
      status: a.status,
      wordCount: a.wordCount,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      template: a.template,
      category: a.category,
      author: a.author,
    })),
  );
}

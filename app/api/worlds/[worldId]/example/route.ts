import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ROLE_RANK, getMemberRole } from "@/lib/permissions";
import { ARUNIKA, BUILTIN_TEMPLATES } from "@/lib/seed-data";
import { slugify, uniqueSlug } from "@/lib/slug";
import { excerptOf, wordCount } from "@/lib/markdown";

function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

/**
 * POST /api/worlds/[worldId]/example — buat dunia contoh "Arunika".
 * Body: { workspaceId }. Butuh EDITOR+ di workspace tersebut.
 * Segmen [worldId] pada path tidak dipakai — world baru selalu dibuat.
 * Menolak (400) bila dunia bernama "Arunika" sudah ada di workspace itu.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string }> },
) {
  await params; // segmen path ada demi konsistensi URL
  const user = await getSessionUser();
  if (!user) return fail("Harus login terlebih dahulu.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("Body harus JSON: { workspaceId }.", 400);
  }
  const workspaceId =
    typeof body === "object" && body !== null && typeof (body as { workspaceId?: unknown }).workspaceId === "string"
      ? ((body as { workspaceId: string }).workspaceId as string)
      : null;
  if (!workspaceId) return fail("workspaceId wajib diisi.", 400);

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });
  if (!workspace) return fail("Workspace tidak ditemukan.", 404);

  const role = await getMemberRole(workspaceId, user.userId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.EDITOR) {
    return fail("Membuat dunia contoh butuh peran Editor atau lebih tinggi.", 403);
  }

  const existing = await prisma.world.findFirst({
    where: { workspaceId, name: ARUNIKA.name },
    select: { id: true },
  });
  if (existing) {
    return fail(`Dunia "${ARUNIKA.name}" sudah ada di workspace ini.`, 400);
  }

  const world = await prisma.world.create({
    data: {
      workspaceId,
      name: ARUNIKA.name,
      description: ARUNIKA.description,
      genre: ARUNIKA.genre,
      tags: ARUNIKA.tags,
      isPublic: false,
    },
  });

  const categoryByName = new Map<string, string>();
  for (const name of ARUNIKA.categories) {
    const created = await prisma.category.create({
      data: { worldId: world.id, name },
    });
    categoryByName.set(name, created.id);
  }

  // Cari template bawaan berdasarkan nama; bila belum ada di database
  // (seed belum dijalankan), buat salinan khusus-world dari definisinya.
  const templateByName = new Map<string, string>();
  for (const name of new Set(ARUNIKA.articles.map((a) => a.template))) {
    const builtin = await prisma.template.findFirst({
      where: { worldId: null, name },
      select: { id: true },
    });
    if (builtin) {
      templateByName.set(name, builtin.id);
      continue;
    }
    const def = BUILTIN_TEMPLATES.find((t) => t.name === name);
    const created = await prisma.template.create({
      data: {
        worldId: world.id,
        name,
        description: def?.description ?? null,
        fields: (def?.fields ?? []) as Prisma.InputJsonValue,
        isBuiltIn: false,
      },
    });
    templateByName.set(name, created.id);
  }

  const takenSlugs = new Set<string>();
  const articleByTitle = new Map<string, string>();
  for (const a of ARUNIKA.articles) {
    const base = slugify(a.title);
    const slug = uniqueSlug(base, takenSlugs);
    takenSlugs.add(slug);
    const created = await prisma.article.create({
      data: {
        worldId: world.id,
        templateId: templateByName.get(a.template) ?? null,
        categoryId: categoryByName.get(a.category) ?? null,
        title: a.title,
        slug,
        content: a.content,
        fieldValues: {},
        excerpt: excerptOf(a.content),
        status: "PUBLISHED",
        wordCount: wordCount(a.content),
        createdById: user.userId,
      },
    });
    articleByTitle.set(a.title, created.id);
  }

  let relationshipsCount = 0;
  for (const r of ARUNIKA.relationships) {
    const fromId = articleByTitle.get(r.from);
    const toId = articleByTitle.get(r.to);
    if (!fromId || !toId) continue;
    await prisma.relationship.create({
      data: {
        worldId: world.id,
        fromArticleId: fromId,
        toArticleId: toId,
        type: r.type,
      },
    });
    relationshipsCount++;
  }

  return ok(
    {
      world: { id: world.id, name: world.name },
      summary: {
        categories: ARUNIKA.categories.length,
        articles: ARUNIKA.articles.length,
        relationships: relationshipsCount,
      },
    },
    201,
  );
}

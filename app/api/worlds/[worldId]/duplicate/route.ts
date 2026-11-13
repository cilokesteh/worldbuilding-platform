import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { requireRole } from "@/lib/permissions";

function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function uniqueSlug(base: string, taken: Set<string>): string {
  let slug = base;
  let i = 2;
  while (taken.has(slug)) {
    slug = `${base}-${i}`;
    i++;
  }
  return slug;
}

type Params = { params: Promise<{ worldId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const { worldId: id } = await params;
  const user = await getSessionUser();
  if (!user) return fail("Anda harus masuk terlebih dahulu.", 401);

  const source = await prisma.world.findUnique({
    where: { id },
    include: {
      categories: true,
      templates: { where: { worldId: id } },
      articles: true,
      relationships: true,
    },
  });
  if (!source) return fail("World tidak ditemukan.", 404);

  try {
    await requireRole(source.workspaceId, user.userId, "EDITOR");
  } catch {
    return fail("Minimal role Editor untuk menduplikasi world.", 403);
  }

  const result = await prisma.$transaction(async (tx) => {
    const copy = await tx.world.create({
      data: {
        workspaceId: source.workspaceId,
        name: `${source.name} (Salinan)`,
        description: source.description,
        genre: source.genre,
        tags: source.tags,
        // World salinan selalu privat; media TIDAK disalin (cover ikut kosong).
        isPublic: false,
        coverMediaId: null,
      },
    });

    const categoryMap = new Map<string, string>();
    for (const c of source.categories) {
      const nc = await tx.category.create({
        data: { worldId: copy.id, name: c.name, color: c.color },
      });
      categoryMap.set(c.id, nc.id);
    }

    const templateMap = new Map<string, string>();
    for (const t of source.templates) {
      const nt = await tx.template.create({
        data: {
          worldId: copy.id,
          name: t.name,
          description: t.description,
          fields: t.fields as Prisma.InputJsonValue,
          isBuiltIn: false,
        },
      });
      templateMap.set(t.id, nt.id);
    }

    const takenSlugs = new Set<string>();
    const articleMap = new Map<string, string>();
    for (const a of source.articles) {
      const slug = uniqueSlug(`${a.slug}-salinan`, takenSlugs);
      takenSlugs.add(slug);
      const na = await tx.article.create({
        data: {
          worldId: copy.id,
          // Template bawaan global (worldId null) dipakai bersama, jadi id-nya dipertahankan.
          templateId: a.templateId ? (templateMap.get(a.templateId) ?? a.templateId) : null,
          categoryId: a.categoryId ? (categoryMap.get(a.categoryId) ?? null) : null,
          title: a.title,
          slug,
          content: a.content,
          fieldValues: a.fieldValues as Prisma.InputJsonValue,
          excerpt: a.excerpt,
          status: a.status,
          coverMediaId: null,
          wordCount: a.wordCount,
          createdById: user.userId,
        },
      });
      articleMap.set(a.id, na.id);
    }

    let relationshipsCopied = 0;
    for (const r of source.relationships) {
      const fromId = articleMap.get(r.fromArticleId);
      const toId = articleMap.get(r.toArticleId);
      if (!fromId || !toId) continue;
      await tx.relationship.create({
        data: {
          worldId: copy.id,
          fromArticleId: fromId,
          toArticleId: toId,
          type: r.type,
          label: r.label,
        },
      });
      relationshipsCopied++;
    }

    return {
      world: copy,
      categoriesCopied: categoryMap.size,
      templatesCopied: templateMap.size,
      articlesCopied: articleMap.size,
      relationshipsCopied,
    };
  });

  return ok(
    {
      world: result.world,
      categoriesCopied: result.categoriesCopied,
      templatesCopied: result.templatesCopied,
      articlesCopied: result.articlesCopied,
      relationshipsCopied: result.relationshipsCopied,
      // Media TIDAK disalin saat duplikasi (file tetap milik world asal).
      mediaCopied: false,
    },
    201,
  );
}

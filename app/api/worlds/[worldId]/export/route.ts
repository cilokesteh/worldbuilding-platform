import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getMemberRole, getWorkspaceIdOfWorld } from "@/lib/permissions";
import { slugify } from "@/lib/slug";
import { EXPORT_FORMAT, EXPORT_VERSION } from "@/lib/export-format";

/**
 * GET /api/worlds/[worldId]/export — unduh JSON lengkap satu world.
 * Anggota workspace. Mengembalikan file `world-{slug}.json` (bukan JSON API).
 * Media hanya diekspor sebagai metadata — data base64 TIDAK ikut.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ worldId: string }> },
) {
  const { worldId } = await params;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Harus login terlebih dahulu." },
      { status: 401 },
    );
  }

  const workspaceId = await getWorkspaceIdOfWorld(worldId);
  if (!workspaceId) {
    return NextResponse.json(
      { ok: false, error: "World tidak ditemukan." },
      { status: 404 },
    );
  }
  const role = await getMemberRole(workspaceId, user.userId);
  if (!role) {
    return NextResponse.json(
      { ok: false, error: "Anda bukan anggota workspace ini." },
      { status: 403 },
    );
  }

  const world = await prisma.world.findUnique({
    where: { id: worldId },
    include: {
      categories: { orderBy: { createdAt: "asc" } },
      templates: { orderBy: { createdAt: "asc" } },
      articles: {
        orderBy: { createdAt: "asc" },
        include: { template: { select: { id: true, name: true } } },
      },
      relationships: { orderBy: { createdAt: "asc" } },
      media: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          size: true,
          createdAt: true,
          createdById: true,
        },
      },
    },
  });
  if (!world) {
    return NextResponse.json(
      { ok: false, error: "World tidak ditemukan." },
      { status: 404 },
    );
  }

  // Template bawaan (global) yang dipakai artikel ikut disertakan agar impor
  // bisa memetakannya kembali berdasarkan nama.
  const builtinIds = new Set(
    world.articles
      .map((a) => a.templateId)
      .filter((id): id is string => Boolean(id))
      .filter((id) => !world.templates.some((t) => t.id === id)),
  );
  const builtinTemplates =
    builtinIds.size > 0
      ? await prisma.template.findMany({
          where: { id: { in: [...builtinIds] }, worldId: null },
        })
      : [];

  const payload = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: user.userId,
    world: {
      id: world.id,
      name: world.name,
      description: world.description,
      genre: world.genre,
      tags: world.tags,
      isPublic: world.isPublic,
      createdAt: world.createdAt,
      updatedAt: world.updatedAt,
    },
    categories: world.categories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    })),
    templates: [...world.templates, ...builtinTemplates].map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      fields: t.fields,
      isBuiltIn: t.isBuiltIn,
    })),
    articles: world.articles.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      templateName: a.template?.name ?? null,
      categoryName:
        world.categories.find((c) => c.id === a.categoryId)?.name ?? null,
      content: a.content,
      fieldValues: a.fieldValues,
      excerpt: a.excerpt,
      status: a.status,
      wordCount: a.wordCount,
      createdById: a.createdById,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
    relationships: world.relationships.map((r) => ({
      id: r.id,
      fromArticleId: r.fromArticleId,
      toArticleId: r.toArticleId,
      type: r.type,
      label: r.label,
    })),
    // Catatan: media hanya metadata. File aslinya (base64) tidak ikut
    // diekspor — unduh tiap file lewat endpoint media bila diperlukan.
    media: world.media.map((m) => ({
      id: m.id,
      filename: m.filename,
      mimeType: m.mimeType,
      size: m.size,
      createdAt: m.createdAt,
      createdById: m.createdById,
      note: "File tidak ikut diekspor; hanya metadata.",
    })),
  };

  const filename = `world-${slugify(world.name)}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

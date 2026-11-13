import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { slugify } from "@/lib/slug";

/**
 * GET /api/account/export — unduh JSON seluruh data akun pengguna yang login:
 * profil + workspace yang dimiliki/diikuti + semua world, artikel, dan
 * metadata media di dalamnya. Mengembalikan file unduhan (bukan JSON API).
 * Data file media (base64) tidak ikut — hanya metadata.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Harus login terlebih dahulu." },
      { status: 401 },
    );
  }

  const profile = await prisma.user.findUnique({
    where: { id: user.userId },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerifiedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "Akun tidak ditemukan." },
      { status: 404 },
    );
  }

  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.userId },
    include: { workspace: true },
    orderBy: { createdAt: "asc" },
  });
  const owned = await prisma.workspace.findMany({
    where: { ownerId: user.userId },
    orderBy: { createdAt: "asc" },
  });

  const workspaceIds = [
    ...new Set([
      ...owned.map((w) => w.id),
      ...memberships.map((m) => m.workspaceId),
    ]),
  ];

  const worlds = await prisma.world.findMany({
    where: { workspaceId: { in: workspaceIds } },
    include: {
      categories: { orderBy: { createdAt: "asc" } },
      templates: { orderBy: { createdAt: "asc" } },
      articles: { orderBy: { createdAt: "asc" } },
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
    orderBy: { createdAt: "asc" },
  });

  const payload = {
    format: "worldbuilding-platform-account-export",
    version: 1,
    exportedAt: new Date().toISOString(),
    user: profile,
    workspacesOwned: owned.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      createdAt: w.createdAt,
    })),
    workspaceMemberships: memberships.map((m) => ({
      workspaceId: m.workspaceId,
      workspaceName: m.workspace.name,
      role: m.role,
      joinedAt: m.createdAt,
    })),
    worlds: worlds.map((w) => ({
      id: w.id,
      workspaceId: w.workspaceId,
      name: w.name,
      description: w.description,
      genre: w.genre,
      tags: w.tags,
      isPublic: w.isPublic,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      categories: w.categories,
      templates: w.templates,
      articles: w.articles,
      relationships: w.relationships,
      // Hanya metadata media; file (base64) tidak ikut diekspor.
      media: w.media,
    })),
  };

  const filename = `akun-${slugify(profile.name) || "export"}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

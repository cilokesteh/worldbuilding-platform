import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canReadWorld, requireRole } from "@/lib/permissions";

function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

type Params = { params: Promise<{ worldId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { worldId: id } = await params;
  const user = await getSessionUser();

  const world = await prisma.world.findUnique({
    where: { id },
    include: {
      workspace: { select: { id: true, name: true } },
      _count: { select: { articles: true, media: true, templates: true, categories: true } },
    },
  });
  if (!world) return fail("World tidak ditemukan.", 404);

  const allowed = await canReadWorld(id, user?.userId ?? null);
  if (!allowed) {
    return fail(
      user ? "Anda bukan anggota workspace world ini." : "Anda harus masuk terlebih dahulu.",
      user ? 403 : 401,
    );
  }

  return ok(world);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { worldId: id } = await params;
  const user = await getSessionUser();
  if (!user) return fail("Anda harus masuk terlebih dahulu.", 401);

  const world = await prisma.world.findUnique({ where: { id }, select: { id: true, workspaceId: true } });
  if (!world) return fail("World tidak ditemukan.", 404);

  try {
    await requireRole(world.workspaceId, user.userId, "ADMIN");
  } catch {
    return fail("Hanya Owner atau Admin yang dapat mengubah world.", 403);
  }

  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    description?: unknown;
    genre?: unknown;
    tags?: unknown;
    isPublic?: unknown;
  } | null;
  const data: {
    name?: string;
    description?: string | null;
    genre?: string | null;
    tags?: string[];
    isPublic?: boolean;
  } = {};
  if (body?.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return fail("Nama world tidak boleh kosong.");
    data.name = name;
  }
  if (body?.description !== undefined) {
    data.description = typeof body.description === "string" ? body.description.trim() || null : null;
  }
  if (body?.genre !== undefined) {
    data.genre = typeof body.genre === "string" ? body.genre.trim() || null : null;
  }
  if (body?.tags !== undefined) {
    if (!Array.isArray(body.tags)) return fail("tags harus berupa array string.");
    data.tags = body.tags
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  if (body?.isPublic !== undefined) {
    if (typeof body.isPublic !== "boolean") return fail("isPublic harus berupa boolean.");
    data.isPublic = body.isPublic;
  }
  if (Object.keys(data).length === 0) return fail("Tidak ada perubahan yang diberikan.");

  const updated = await prisma.world.update({ where: { id }, data });
  return ok(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { worldId: id } = await params;
  const user = await getSessionUser();
  if (!user) return fail("Anda harus masuk terlebih dahulu.", 401);

  const world = await prisma.world.findUnique({ where: { id }, select: { id: true, workspaceId: true } });
  if (!world) return fail("World tidak ditemukan.", 404);

  try {
    await requireRole(world.workspaceId, user.userId, "OWNER");
  } catch {
    return fail("Hanya Owner yang dapat menghapus world.", 403);
  }

  await prisma.world.delete({ where: { id } });
  return ok({ deleted: true });
}

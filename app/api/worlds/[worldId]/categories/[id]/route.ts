import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getMemberRole, getWorkspaceIdOfWorld, ROLE_RANK } from "@/lib/permissions";

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

type Ctx = { params: Promise<{ worldId: string; id: string }> };

async function loadCategory(worldId: string, id: string) {
  return prisma.category.findFirst({ where: { id, worldId } });
}

/** PATCH /api/worlds/[worldId]/categories/[id] — EDITOR+. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { worldId, id } = await params;
  const workspaceId = await getWorkspaceIdOfWorld(worldId);
  if (!workspaceId) return fail("World tidak ditemukan", 404);
  const role = await getMemberRole(workspaceId, user.userId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.EDITOR) return fail("Butuh peran Editor atau lebih tinggi", 403);
  const category = await loadCategory(worldId, id);
  if (!category) return fail("Kategori tidak ditemukan", 404);
  const body = await readBody(req);
  const data: { name?: string; color?: string | null } = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return fail("Nama kategori tidak boleh kosong", 400);
    if (name !== category.name) {
      const clash = await prisma.category.findUnique({ where: { worldId_name: { worldId, name } } });
      if (clash) return fail(`Kategori "${name}" sudah ada di world ini`, 400);
    }
    data.name = name;
  }
  if (typeof body.color === "string") {
    data.color = body.color.trim() === "" ? null : body.color.trim();
  }
  const updated = await prisma.category.update({ where: { id }, data });
  return succeed(updated);
}

/** DELETE /api/worlds/[worldId]/categories/[id] — EDITOR+. Artikelnya jadi tanpa kategori. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { worldId, id } = await params;
  const workspaceId = await getWorkspaceIdOfWorld(worldId);
  if (!workspaceId) return fail("World tidak ditemukan", 404);
  const role = await getMemberRole(workspaceId, user.userId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.EDITOR) return fail("Butuh peran Editor atau lebih tinggi", 403);
  const category = await loadCategory(worldId, id);
  if (!category) return fail("Kategori tidak ditemukan", 404);
  await prisma.category.delete({ where: { id } });
  return succeed({ deleted: true, id });
}

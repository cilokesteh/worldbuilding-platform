import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ROLE_RANK, getMemberRole, getWorkspaceIdOfWorld } from "@/lib/permissions";

function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

const mediaMetaSelect = {
  id: true,
  filename: true,
  mimeType: true,
  size: true,
  createdAt: true,
  createdById: true,
  uploader: { select: { id: true, name: true } },
} as const;

async function loadMedia(worldId: string, id: string) {
  return prisma.mediaAsset.findFirst({
    where: { id, worldId },
    select: mediaMetaSelect,
  });
}

/** GET /api/worlds/[worldId]/media/[id] — metadata satu media. Anggota workspace. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ worldId: string; id: string }> },
) {
  const { worldId, id } = await params;
  const user = await getSessionUser();
  if (!user) return fail("Harus login terlebih dahulu.", 401);

  const workspaceId = await getWorkspaceIdOfWorld(worldId);
  if (!workspaceId) return fail("World tidak ditemukan.", 404);
  const role = await getMemberRole(workspaceId, user.userId);
  if (!role) return fail("Anda bukan anggota workspace ini.", 403);

  const item = await loadMedia(worldId, id);
  if (!item) return fail("Media tidak ditemukan.", 404);
  return ok({ item });
}

/** DELETE /api/worlds/[worldId]/media/[id] — hapus media. Butuh EDITOR+. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ worldId: string; id: string }> },
) {
  const { worldId, id } = await params;
  const user = await getSessionUser();
  if (!user) return fail("Harus login terlebih dahulu.", 401);

  const workspaceId = await getWorkspaceIdOfWorld(worldId);
  if (!workspaceId) return fail("World tidak ditemukan.", 404);
  const role = await getMemberRole(workspaceId, user.userId);
  if (!role) return fail("Anda bukan anggota workspace ini.", 403);
  if (ROLE_RANK[role] < ROLE_RANK.EDITOR) {
    return fail("Menghapus media butuh peran Editor atau lebih tinggi.", 403);
  }

  const item = await loadMedia(worldId, id);
  if (!item) return fail("Media tidak ditemukan.", 404);

  await prisma.mediaAsset.delete({ where: { id } });
  return ok({ deletedId: id });
}

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

type Ctx = { params: Promise<{ id: string }> };

/** DELETE /api/relationships/[id] — EDITOR+ di workspace world-nya. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { id } = await params;
  const rel = await prisma.relationship.findUnique({
    where: { id },
    include: { world: { select: { workspaceId: true } } },
  });
  if (!rel) return fail("Relasi tidak ditemukan", 404);
  const role = await getMemberRole(rel.world.workspaceId, user.userId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.EDITOR) return fail("Butuh peran Editor atau lebih tinggi", 403);
  await prisma.relationship.delete({ where: { id } });
  return succeed({ deleted: true, id });
}

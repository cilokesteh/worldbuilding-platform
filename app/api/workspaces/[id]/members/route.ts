import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getMemberRole, requireRole, ROLES } from "@/lib/permissions";

function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return fail("Anda harus masuk terlebih dahulu.", 401);

  const workspace = await prisma.workspace.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!workspace) return fail("Workspace tidak ditemukan.", 404);

  const role = await getMemberRole(id, user.userId);
  if (!role) return fail("Anda bukan anggota workspace ini.", 403);

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId: id },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return ok({
    ownerId: workspace.ownerId,
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      user: m.user,
      createdAt: m.createdAt,
    })),
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return fail("Anda harus masuk terlebih dahulu.", 401);

  const workspace = await prisma.workspace.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!workspace) return fail("Workspace tidak ditemukan.", 404);

  try {
    await requireRole(id, user.userId, "ADMIN");
  } catch {
    return fail("Hanya Owner atau Admin yang dapat mengubah role anggota.", 403);
  }

  const body = (await req.json().catch(() => null)) as {
    userId?: unknown;
    role?: unknown;
  } | null;
  const targetUserId = typeof body?.userId === "string" ? body.userId : "";
  const role = typeof body?.role === "string" ? body.role : "";
  if (!targetUserId) return fail("userId wajib diisi.");
  if (!(ROLES as string[]).includes(role)) return fail("Role tidak valid.");

  const target = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId: targetUserId } },
  });
  if (!target) return fail("Anggota tidak ditemukan.", 404);
  if (target.userId === workspace.ownerId || target.role === "OWNER") {
    return fail("Role Owner tidak dapat diubah.");
  }

  const updated = await prisma.workspaceMember.update({
    where: { id: target.id },
    data: { role: role as (typeof ROLES)[number] },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return ok({
    id: updated.id,
    userId: updated.userId,
    role: updated.role,
    user: updated.user,
    createdAt: updated.createdAt,
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return fail("Anda harus masuk terlebih dahulu.", 401);

  const workspace = await prisma.workspace.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!workspace) return fail("Workspace tidak ditemukan.", 404);

  try {
    await requireRole(id, user.userId, "ADMIN");
  } catch {
    return fail("Hanya Owner atau Admin yang dapat menghapus anggota.", 403);
  }

  const targetUserId = req.nextUrl.searchParams.get("userId");
  if (!targetUserId) return fail("userId wajib diisi.");

  const target = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId: targetUserId } },
  });
  if (!target) return fail("Anggota tidak ditemukan.", 404);
  if (target.userId === workspace.ownerId || target.role === "OWNER") {
    return fail("Owner workspace tidak dapat dihapus.");
  }

  await prisma.workspaceMember.delete({ where: { id: target.id } });
  return ok({ deleted: true });
}

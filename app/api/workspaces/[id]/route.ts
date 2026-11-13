import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getMemberRole, requireRole } from "@/lib/permissions";

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

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { worlds: true, members: true } },
    },
  });
  if (!workspace) return fail("Workspace tidak ditemukan.", 404);

  const role = await getMemberRole(id, user.userId);
  if (!role) return fail("Anda bukan anggota workspace ini.", 403);

  return ok({ ...workspace, role });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return fail("Anda harus masuk terlebih dahulu.", 401);

  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) return fail("Workspace tidak ditemukan.", 404);

  try {
    await requireRole(id, user.userId, "ADMIN");
  } catch {
    return fail("Hanya Owner atau Admin yang dapat mengubah workspace.", 403);
  }

  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    description?: unknown;
  } | null;
  const data: { name?: string; description?: string | null } = {};
  if (body?.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return fail("Nama workspace tidak boleh kosong.");
    data.name = name;
  }
  if (body?.description !== undefined) {
    data.description =
      typeof body.description === "string" ? body.description.trim() || null : null;
  }
  if (Object.keys(data).length === 0) return fail("Tidak ada perubahan yang diberikan.");

  const updated = await prisma.workspace.update({ where: { id }, data });
  return ok(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return fail("Anda harus masuk terlebih dahulu.", 401);

  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) return fail("Workspace tidak ditemukan.", 404);

  try {
    await requireRole(id, user.userId, "OWNER");
  } catch {
    return fail("Hanya Owner yang dapat menghapus workspace.", 403);
  }

  await prisma.workspace.delete({ where: { id } });
  return ok({ deleted: true });
}

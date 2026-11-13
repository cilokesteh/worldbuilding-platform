import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { requireRole, ROLES } from "@/lib/permissions";

function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return fail("Anda harus masuk terlebih dahulu.", 401);

  const workspace = await prisma.workspace.findUnique({ where: { id }, select: { id: true, ownerId: true } });
  if (!workspace) return fail("Workspace tidak ditemukan.", 404);

  try {
    await requireRole(id, user.userId, "ADMIN");
  } catch {
    return fail("Hanya Owner atau Admin yang dapat mengundang anggota.", 403);
  }

  const body = (await req.json().catch(() => null)) as {
    email?: unknown;
    role?: unknown;
  } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = typeof body?.role === "string" ? body.role : "";
  if (!email) return fail("Email wajib diisi.");
  if (!(ROLES as string[]).includes(role)) return fail("Role tidak valid.");

  const target = await prisma.user.findUnique({ where: { email } });
  if (!target) return fail("Pengguna belum terdaftar.", 404);

  if (target.id === workspace.ownerId) {
    return fail("Pengguna sudah menjadi anggota workspace ini.");
  }
  const existing = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: id, userId: target.id } },
  });
  if (existing) return fail("Pengguna sudah menjadi anggota workspace ini.");

  const member = await prisma.workspaceMember.create({
    data: { workspaceId: id, userId: target.id, role: role as (typeof ROLES)[number] },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return ok(
    {
      id: member.id,
      userId: member.userId,
      role: member.role,
      user: member.user,
      createdAt: member.createdAt,
    },
    201,
  );
}

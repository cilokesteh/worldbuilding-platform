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

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return fail("Anda harus masuk terlebih dahulu.", 401);

  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return fail("workspaceId wajib diisi.");

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!workspace) return fail("Workspace tidak ditemukan.", 404);

  const role = await getMemberRole(workspaceId, user.userId);
  if (!role) return fail("Anda bukan anggota workspace ini.", 403);

  const worlds = await prisma.world.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { articles: true } } },
  });

  return ok(worlds);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return fail("Anda harus masuk terlebih dahulu.", 401);

  const body = (await req.json().catch(() => null)) as {
    workspaceId?: unknown;
    name?: unknown;
    description?: unknown;
    genre?: unknown;
    tags?: unknown;
  } | null;
  const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const genre = typeof body?.genre === "string" ? body.genre.trim() : "";
  const tags = Array.isArray(body?.tags)
    ? body.tags.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean)
    : [];

  if (!workspaceId) return fail("workspaceId wajib diisi.");
  if (!name) return fail("Nama world wajib diisi.");

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!workspace) return fail("Workspace tidak ditemukan.", 404);

  try {
    await requireRole(workspaceId, user.userId, "EDITOR");
  } catch {
    return fail("Minimal role Editor untuk membuat world.", 403);
  }

  const world = await prisma.world.create({
    data: {
      workspaceId,
      name,
      description: description || undefined,
      genre: genre || undefined,
      tags,
    },
  });

  return ok(world, 201);
}

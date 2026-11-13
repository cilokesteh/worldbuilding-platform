import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return fail("Anda harus masuk terlebih dahulu.", 401);

  const workspaces = await prisma.workspace.findMany({
    where: {
      OR: [{ ownerId: user.userId }, { members: { some: { userId: user.userId } } }],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { worlds: true, members: true } },
      members: { where: { userId: user.userId }, select: { role: true } },
    },
  });

  const data = workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    ownerId: w.ownerId,
    role: w.ownerId === user.userId ? "OWNER" : (w.members[0]?.role ?? "VIEWER"),
    worldCount: w._count.worlds,
    memberCount: w._count.members,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  }));

  return ok(data);
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return fail("Anda harus masuk terlebih dahulu.", 401);

  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    description?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  if (!name) return fail("Nama workspace wajib diisi.");

  const workspace = await prisma.workspace.create({
    data: {
      name,
      description: description || undefined,
      ownerId: user.userId,
      members: { create: { userId: user.userId, role: "OWNER" } },
    },
  });

  return ok(
    {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      ownerId: workspace.ownerId,
      role: "OWNER",
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    },
    201,
  );
}

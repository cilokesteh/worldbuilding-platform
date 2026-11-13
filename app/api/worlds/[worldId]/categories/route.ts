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

type Ctx = { params: Promise<{ worldId: string }> };

/** Anggota workspace saja. */
async function requireMember(worldId: string, userId: string) {
  const workspaceId = await getWorkspaceIdOfWorld(worldId);
  if (!workspaceId) return { workspaceId: null, role: null } as const;
  const role = await getMemberRole(workspaceId, userId);
  return { workspaceId, role } as const;
}

/** GET /api/worlds/[worldId]/categories — daftar kategori world. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { worldId } = await params;
  const { workspaceId, role } = await requireMember(worldId, user.userId);
  if (!workspaceId) return fail("World tidak ditemukan", 404);
  if (!role) return fail("Bukan anggota workspace ini", 403);
  const categories = await prisma.category.findMany({
    where: { worldId },
    orderBy: { name: "asc" },
    include: { _count: { select: { articles: true } } },
  });
  return succeed(
    categories.map((c) => ({
      id: c.id,
      worldId: c.worldId,
      name: c.name,
      color: c.color,
      articleCount: c._count.articles,
      createdAt: c.createdAt,
    })),
  );
}

/** POST /api/worlds/[worldId]/categories — EDITOR+. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { worldId } = await params;
  const { workspaceId, role } = await requireMember(worldId, user.userId);
  if (!workspaceId) return fail("World tidak ditemukan", 404);
  if (!role || ROLE_RANK[role] < ROLE_RANK.EDITOR) return fail("Butuh peran Editor atau lebih tinggi", 403);
  const body = await readBody(req);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const color = typeof body.color === "string" && body.color.trim() !== "" ? body.color.trim() : null;
  if (!name) return fail("Nama kategori wajib diisi", 400);
  const existing = await prisma.category.findUnique({ where: { worldId_name: { worldId, name } } });
  if (existing) return fail(`Kategori "${name}" sudah ada di world ini`, 400);
  const created = await prisma.category.create({ data: { worldId, name, color } });
  return succeed({ ...created, articleCount: 0 }, 201);
}

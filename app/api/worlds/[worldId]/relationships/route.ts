import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
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

/** GET /api/worlds/[worldId]/relationships — daftar relasi world. Anggota saja. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { worldId } = await params;
  const workspaceId = await getWorkspaceIdOfWorld(worldId);
  if (!workspaceId) return fail("World tidak ditemukan", 404);
  const role = await getMemberRole(workspaceId, user.userId);
  if (!role) return fail("Bukan anggota workspace ini", 403);
  const rels = await prisma.relationship.findMany({
    where: { worldId },
    orderBy: { createdAt: "desc" },
    include: {
      from: { select: { id: true, title: true, slug: true } },
      to: { select: { id: true, title: true, slug: true } },
    },
  });
  return succeed(
    rels.map((r) => ({
      id: r.id,
      worldId: r.worldId,
      fromArticleId: r.fromArticleId,
      toArticleId: r.toArticleId,
      type: r.type,
      label: r.label,
      createdAt: r.createdAt,
      from: r.from,
      to: r.to,
    })),
  );
}

/** POST /api/worlds/[worldId]/relationships — EDITOR+. Tolak from==to & duplikat. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { worldId } = await params;
  const workspaceId = await getWorkspaceIdOfWorld(worldId);
  if (!workspaceId) return fail("World tidak ditemukan", 404);
  const role = await getMemberRole(workspaceId, user.userId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.EDITOR) return fail("Butuh peran Editor atau lebih tinggi", 403);

  const body = await readBody(req);
  const fromArticleId = typeof body.fromArticleId === "string" ? body.fromArticleId : "";
  const toArticleId = typeof body.toArticleId === "string" ? body.toArticleId : "";
  const type = typeof body.type === "string" ? body.type.trim() : "";
  const label = typeof body.label === "string" && body.label.trim() !== "" ? body.label.trim() : null;
  if (!fromArticleId || !toArticleId) return fail("fromArticleId dan toArticleId wajib diisi", 400);
  if (!type) return fail("Jenis relasi wajib diisi", 400);
  if (fromArticleId === toArticleId) return fail("Artikel tidak bisa berelasi dengan dirinya sendiri", 400);

  const articles = await prisma.article.findMany({
    where: { id: { in: [fromArticleId, toArticleId] }, worldId },
    select: { id: true },
  });
  if (articles.length !== 2) return fail("Kedua artikel harus ada di world ini", 400);

  try {
    const created = await prisma.relationship.create({
      data: { worldId, fromArticleId, toArticleId, type, label },
      include: {
        from: { select: { id: true, title: true, slug: true } },
        to: { select: { id: true, title: true, slug: true } },
      },
    });
    return succeed(
      {
        id: created.id,
        worldId: created.worldId,
        fromArticleId: created.fromArticleId,
        toArticleId: created.toArticleId,
        type: created.type,
        label: created.label,
        createdAt: created.createdAt,
        from: created.from,
        to: created.to,
      },
      201,
    );
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("Relasi dengan jenis yang sama sudah ada di antara kedua artikel ini", 409);
    }
    throw e;
  }
}

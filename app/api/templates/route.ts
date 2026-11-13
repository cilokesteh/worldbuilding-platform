import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getMemberRole, ROLE_RANK } from "@/lib/permissions";
import type { TemplateFieldDef } from "@/lib/seed-data";
import { validateFields } from "@/lib/template-fields";

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

function serializeTemplate(t: {
  id: string;
  worldId: string | null;
  name: string;
  description: string | null;
  fields: unknown;
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { articles: number };
}) {
  return {
    id: t.id,
    worldId: t.worldId,
    name: t.name,
    description: t.description,
    fields: (Array.isArray(t.fields) ? t.fields : []) as TemplateFieldDef[],
    isBuiltIn: t.isBuiltIn,
    articleCount: t._count?.articles ?? 0,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

/**
 * GET /api/templates?worldId=...
 * Template bawaan (worldId null, isBuiltIn) + template milik world itu.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const worldId = req.nextUrl.searchParams.get("worldId");
  if (!worldId) {
    const builtins = await prisma.template.findMany({
      where: { worldId: null, isBuiltIn: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { articles: true } } },
    });
    return succeed(builtins.map(serializeTemplate));
  }
  const world = await prisma.world.findUnique({ where: { id: worldId }, select: { workspaceId: true } });
  if (!world) return fail("World tidak ditemukan", 404);
  const role = await getMemberRole(world.workspaceId, user.userId);
  if (!role) return fail("Bukan anggota workspace ini", 403);
  const templates = await prisma.template.findMany({
    where: { OR: [{ worldId: null, isBuiltIn: true }, { worldId }] },
    orderBy: [{ isBuiltIn: "desc" }, { name: "asc" }],
    include: { _count: { select: { articles: true } } },
  });
  return succeed(templates.map(serializeTemplate));
}

/** POST /api/templates — buat template kustom di sebuah world. Butuh EDITOR+. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const body = await readBody(req);
  const worldId = typeof body.worldId === "string" ? body.worldId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" && body.description.trim() !== "" ? body.description.trim() : null;
  if (!worldId) return fail("worldId wajib diisi", 400);
  if (!name) return fail("Nama template wajib diisi", 400);
  const checked = validateFields(body.fields);
  if (!checked.ok) return fail(checked.error, 400);
  const world = await prisma.world.findUnique({ where: { id: worldId }, select: { workspaceId: true } });
  if (!world) return fail("World tidak ditemukan", 404);
  const role = await getMemberRole(world.workspaceId, user.userId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.EDITOR) return fail("Butuh peran Editor atau lebih tinggi", 403);
  const created = await prisma.template.create({
    data: {
      worldId,
      name,
      description,
      fields: checked.fields as unknown as Prisma.InputJsonValue,
      isBuiltIn: false,
    },
    include: { _count: { select: { articles: true } } },
  });
  return succeed(serializeTemplate(created), 201);
}

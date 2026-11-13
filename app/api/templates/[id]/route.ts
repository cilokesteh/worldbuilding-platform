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

type Ctx = { params: Promise<{ id: string }> };

async function loadTemplate(id: string) {
  return prisma.template.findUnique({
    where: { id },
    include: { _count: { select: { articles: true } } },
  });
}

/** GET /api/templates/[id] */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { id } = await params;
  const template = await loadTemplate(id);
  if (!template) return fail("Template tidak ditemukan", 404);
  if (template.worldId) {
    const world = await prisma.world.findUnique({ where: { id: template.worldId }, select: { workspaceId: true } });
    if (!world) return fail("Template tidak ditemukan", 404);
    const role = await getMemberRole(world.workspaceId, user.userId);
    if (!role) return fail("Bukan anggota workspace ini", 403);
  }
  return succeed(serializeTemplate(template));
}

/**
 * PATCH /api/templates/[id] — EDITOR+. Template bawaan TIDAK boleh diedit.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { id } = await params;
  const template = await loadTemplate(id);
  if (!template) return fail("Template tidak ditemukan", 404);
  if (template.isBuiltIn || !template.worldId) {
    return fail("Template bawaan tidak boleh diedit", 403);
  }
  const world = await prisma.world.findUnique({ where: { id: template.worldId }, select: { workspaceId: true } });
  if (!world) return fail("Template tidak ditemukan", 404);
  const role = await getMemberRole(world.workspaceId, user.userId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.EDITOR) return fail("Butuh peran Editor atau lebih tinggi", 403);

  const body = await readBody(req);
  const data: { name?: string; description?: string | null; fields?: Prisma.InputJsonValue } = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return fail("Nama template tidak boleh kosong", 400);
    data.name = name;
  }
  if (typeof body.description === "string") {
    data.description = body.description.trim() === "" ? null : body.description.trim();
  }
  if (body.fields !== undefined) {
    const checked = validateFields(body.fields);
    if (!checked.ok) return fail(checked.error, 400);
    data.fields = checked.fields as unknown as Prisma.InputJsonValue;
  }
  const updated = await prisma.template.update({
    where: { id },
    data,
    include: { _count: { select: { articles: true } } },
  });
  return succeed(serializeTemplate(updated));
}

/**
 * DELETE /api/templates/[id] — EDITOR+. Template bawaan tidak boleh dihapus;
 * tolak kalau masih dipakai artikel.
 */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const user = await getSessionUser();
  if (!user) return fail("Harus masuk terlebih dahulu", 401);
  const { id } = await params;
  const template = await loadTemplate(id);
  if (!template) return fail("Template tidak ditemukan", 404);
  if (template.isBuiltIn || !template.worldId) {
    return fail("Template bawaan tidak boleh dihapus", 403);
  }
  const world = await prisma.world.findUnique({ where: { id: template.worldId }, select: { workspaceId: true } });
  if (!world) return fail("Template tidak ditemukan", 404);
  const role = await getMemberRole(world.workspaceId, user.userId);
  if (!role || ROLE_RANK[role] < ROLE_RANK.EDITOR) return fail("Butuh peran Editor atau lebih tinggi", 403);
  if (template._count.articles > 0) {
    return fail(`Template masih dipakai ${template._count.articles} artikel dan tidak bisa dihapus`, 400);
  }
  await prisma.template.delete({ where: { id } });
  return succeed({ deleted: true, id });
}

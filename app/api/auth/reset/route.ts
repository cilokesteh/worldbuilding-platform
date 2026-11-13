import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    token?: unknown;
    password?: unknown;
  } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!token) return fail("Token reset tidak ditemukan.");
  if (password.length < 8) return fail("Password minimal 8 karakter.");

  const record = await prisma.emailToken.findUnique({ where: { token } });
  if (!record || record.type !== "RESET" || record.usedAt || record.expiresAt < new Date()) {
    return fail("Token reset tidak valid atau sudah kedaluwarsa.");
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.emailToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  return ok({ reset: true });
}

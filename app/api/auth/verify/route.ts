import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return fail("Token verifikasi tidak ditemukan.");

  const record = await prisma.emailToken.findUnique({ where: { token } });
  if (
    !record ||
    record.type !== "VERIFY" ||
    record.usedAt ||
    record.expiresAt < new Date()
  ) {
    return fail("Token verifikasi tidak valid atau sudah kedaluwarsa.");
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  return ok({ verified: true });
}

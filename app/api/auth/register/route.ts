import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";

function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function fail(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
    email?: unknown;
    password?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!name) return fail("Nama wajib diisi.");
  if (!EMAIL_RE.test(email)) return fail("Format email tidak valid.");
  if (password.length < 8) return fail("Password minimal 8 karakter.");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return fail("Email sudah terdaftar.");

  const passwordHash = await hashPassword(password);
  const token = randomBytes(32).toString("hex");

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({ data: { name, email, passwordHash } });
    await tx.workspace.create({
      data: {
        name: `Workspace ${name}`,
        ownerId: created.id,
        members: { create: { userId: created.id, role: "OWNER" } },
      },
    });
    await tx.emailToken.create({
      data: {
        userId: created.id,
        type: "VERIFY",
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return created;
  });

  // MVP belum ada SMTP: link verifikasi belum dikirim via email, hanya dicatat di log server.
  console.log(`[auth] Link verifikasi untuk ${email}: /verify?token=${token}`);

  await createSession({ id: user.id, email: user.email, name: user.name });
  return ok({ id: user.id, name: user.name, email: user.email }, 201);
}

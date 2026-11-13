import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = randomBytes(32).toString("hex");
      await prisma.emailToken.create({
        data: {
          userId: user.id,
          type: "RESET",
          token,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      // MVP belum ada SMTP: link reset belum dikirim via email, hanya dicatat di log server.
      console.log(`[auth] Link reset password untuk ${email}: /reset?token=${token}`);
    }
  }

  // Selalu ok: jangan bocorkan apakah email terdaftar atau tidak.
  return NextResponse.json({ ok: true, data: {} });
}

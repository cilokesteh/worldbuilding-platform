import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Anda harus masuk terlebih dahulu." }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    data: { id: user.userId, name: user.name, email: user.email },
  });
}

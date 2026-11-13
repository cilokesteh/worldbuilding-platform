import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { canReadWorld } from "@/lib/permissions";

/**
 * GET /api/worlds/[worldId]/media/[id]/file — kembalikan bytes file asli.
 * Akses: anggota workspace, ATAU siapa pun bila world bersifat publik.
 * Mengembalikan Response file langsung (bukan JSON).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ worldId: string; id: string }> },
) {
  const { worldId, id } = await params;
  const user = await getSessionUser();

  const allowed = await canReadWorld(worldId, user?.userId ?? null);
  if (!allowed) {
    return NextResponse.json(
      { ok: false, error: "Media tidak ditemukan atau tidak dapat diakses." },
      { status: 404 },
    );
  }

  const item = await prisma.mediaAsset.findFirst({
    where: { id, worldId },
    select: { filename: true, mimeType: true, data: true },
  });
  if (!item) {
    return NextResponse.json(
      { ok: false, error: "Media tidak ditemukan." },
      { status: 404 },
    );
  }

  const bytes = Buffer.from(item.data, "base64");
  const safeName = item.filename.replace(/["\r\n]/g, "_");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": item.mimeType,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=3600",
    },
  });
}

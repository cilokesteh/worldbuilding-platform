import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ROLE_RANK, getMemberRole, getWorkspaceIdOfWorld } from "@/lib/permissions";

const MAX_MEDIA_BYTES = 6 * 1024 * 1024;

function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

function isAllowedMime(mimeType: string): boolean {
  return (
    mimeType.startsWith("image/") ||
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/")
  );
}

/** Metadata media tanpa kolom data base64. */
const mediaMetaSelect = {
  id: true,
  filename: true,
  mimeType: true,
  size: true,
  createdAt: true,
  createdById: true,
  uploader: { select: { id: true, name: true } },
} as const;

/** GET /api/worlds/[worldId]/media — daftar media (metadata saja). Anggota workspace. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ worldId: string }> },
) {
  const { worldId } = await params;
  const user = await getSessionUser();
  if (!user) return fail("Harus login terlebih dahulu.", 401);

  const workspaceId = await getWorkspaceIdOfWorld(worldId);
  if (!workspaceId) return fail("World tidak ditemukan.", 404);
  const role = await getMemberRole(workspaceId, user.userId);
  if (!role) return fail("Anda bukan anggota workspace ini.", 403);

  const items = await prisma.mediaAsset.findMany({
    where: { worldId },
    select: mediaMetaSelect,
    orderBy: { createdAt: "desc" },
  });
  return ok({ items });
}

/**
 * POST /api/worlds/[worldId]/media — upload satu file (multipart, field "file").
 * Butuh CONTRIBUTOR+. Maks 6 MB; hanya image/*, application/pdf, atau text/*.
 * File disimpan sebagai base64 di MediaAsset.data.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ worldId: string }> },
) {
  const { worldId } = await params;
  const user = await getSessionUser();
  if (!user) return fail("Harus login terlebih dahulu.", 401);

  const workspaceId = await getWorkspaceIdOfWorld(worldId);
  if (!workspaceId) return fail("World tidak ditemukan.", 404);
  const role = await getMemberRole(workspaceId, user.userId);
  if (!role) return fail("Anda bukan anggota workspace ini.", 403);
  if (ROLE_RANK[role] < ROLE_RANK.CONTRIBUTOR) {
    return fail("Upload media butuh peran Kontributor atau lebih tinggi.", 403);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("Body harus multipart/form-data dengan field \"file\".", 400);
  }
  const file = form.get("file");
  if (!file || typeof file === "string") {
    return fail("File tidak ditemukan. Kirim file pada field \"file\".", 400);
  }
  if (file.size > MAX_MEDIA_BYTES) {
    return fail("Ukuran file maksimal 6 MB.", 400);
  }
  if (file.size === 0) {
    return fail("File kosong.", 400);
  }
  if (!isAllowedMime(file.type)) {
    return fail(
      "Tipe file tidak didukung. Hanya gambar (image/*), PDF, atau teks (text/*).",
      400,
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const created = await prisma.mediaAsset.create({
    data: {
      worldId,
      filename: file.name || "file",
      mimeType: file.type,
      size: file.size,
      data: bytes.toString("base64"),
      createdById: user.userId,
    },
    select: mediaMetaSelect,
  });
  return ok({ item: created }, 201);
}

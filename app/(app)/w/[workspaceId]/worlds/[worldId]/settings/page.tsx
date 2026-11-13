import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { getMemberRole, ROLE_RANK } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Button, Card, Input, PageHeader, Textarea } from "@/components/ui";

export default async function WorldSettingsPage({
  params,
}: {
  params: Promise<{ workspaceId: string; worldId: string }>;
}) {
  const { workspaceId, worldId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const world = await prisma.world.findUnique({
    where: { id: worldId },
    include: { workspace: { select: { name: true } } },
  });
  if (!world || world.workspaceId !== workspaceId) notFound();

  const myRole = await getMemberRole(workspaceId, user.userId);
  if (!myRole) {
    return (
      <Card>
        <h1 className="text-lg font-bold text-slate-900">Tidak ada akses</h1>
        <p className="mt-1 text-sm text-slate-600">Anda bukan anggota workspace world ini.</p>
        <div className="mt-4">
          <Button href="/dashboard" variant="secondary">
            Kembali ke Dashboard
          </Button>
        </div>
      </Card>
    );
  }

  const canManage = ROLE_RANK[myRole] >= ROLE_RANK.ADMIN;
  const isOwner = myRole === "OWNER";
  const basePath = `/w/${workspaceId}/worlds/${worldId}`;

  async function updateWorld(formData: FormData) {
    "use server";
    const me = await getSessionUser();
    if (!me) redirect("/login");
    const role = await getMemberRole(workspaceId, me.userId);
    if (!role || ROLE_RANK[role] < ROLE_RANK.ADMIN) return;
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const genre = String(formData.get("genre") ?? "").trim();
    const tagsRaw = String(formData.get("tags") ?? "");
    const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
    if (!name) return;
    await prisma.world.update({
      where: { id: worldId },
      data: { name, description: description || null, genre: genre || null, tags },
    });
    revalidatePath(`${basePath}/settings`);
    revalidatePath(basePath);
  }

  async function togglePublic(formData: FormData) {
    "use server";
    const me = await getSessionUser();
    if (!me) redirect("/login");
    const role = await getMemberRole(workspaceId, me.userId);
    if (!role || ROLE_RANK[role] < ROLE_RANK.ADMIN) return;
    const isPublic = formData.get("isPublic") === "on";
    await prisma.world.update({ where: { id: worldId }, data: { isPublic } });
    revalidatePath(`${basePath}/settings`);
    revalidatePath(basePath);
  }

  async function deleteWorld(formData: FormData) {
    "use server";
    const me = await getSessionUser();
    if (!me) redirect("/login");
    const role = await getMemberRole(workspaceId, me.userId);
    if (role !== "OWNER") return;
    if (String(formData.get("konfirmasi") ?? "") !== "ya") return;
    await prisma.world.delete({ where: { id: worldId } });
    redirect(`/w/${workspaceId}`);
  }

  return (
    <div>
      <PageHeader
        title={`Pengaturan: ${world.name}`}
        desc={`World di workspace ${world.workspace.name}.`}
        actions={
          <Button href={basePath} variant="secondary">
            ← Kembali ke World
          </Button>
        }
      />

      <div className="max-w-2xl space-y-6">
        {canManage ? (
          <>
            <Card>
              <h2 className="font-semibold text-slate-900">Informasi World</h2>
              <form action={updateWorld} className="mt-3 space-y-3">
                <Input label="Nama world" name="name" required defaultValue={world.name} />
                <Textarea label="Deskripsi" name="description" rows={3} defaultValue={world.description ?? ""} />
                <Input label="Genre" name="genre" defaultValue={world.genre ?? ""} placeholder="cth. Fantasi" />
                <Input
                  label="Tag (pisahkan dengan koma)"
                  name="tags"
                  defaultValue={world.tags.join(", ")}
                  placeholder="cth. fantasi, kepulauan, sihir"
                />
                <Button type="submit">Simpan Perubahan</Button>
              </form>
            </Card>

            <Card>
              <h2 className="font-semibold text-slate-900">Publikasi</h2>
              <p className="mt-1 text-sm text-slate-600">
                World publik dapat dilihat siapa pun lewat halaman publik, tanpa perlu masuk.
              </p>
              <form action={togglePublic} className="mt-3 space-y-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="isPublic" defaultChecked={world.isPublic} className="h-4 w-4 accent-emerald-700" />
                  Publikasikan world ini
                </label>
                <Button type="submit" variant="secondary">
                  Simpan Pengaturan Publik
                </Button>
              </form>
              {world.isPublic && (
                <p className="mt-3 text-sm text-slate-600">
                  Halaman publik:{" "}
                  <a href={`/publik/${world.id}`} className="font-medium text-emerald-700 hover:underline">
                    /publik/{world.id}
                  </a>
                </p>
              )}
            </Card>
          </>
        ) : (
          <Card>
            <h2 className="font-semibold text-slate-900">Informasi World</h2>
            <p className="mt-2 text-sm text-slate-600">
              Hanya Owner atau Admin yang dapat mengubah pengaturan world ini.
            </p>
          </Card>
        )}

        <Card>
          <h2 className="font-semibold text-slate-900">Ekspor</h2>
          <p className="mt-1 text-sm text-slate-600">
            Unduh seluruh data world ini sebagai JSON atau Markdown.
          </p>
          <div className="mt-3">
            <Button href={`${basePath}/export`} variant="secondary">
              Buka Halaman Ekspor
            </Button>
          </div>
        </Card>

        {isOwner && (
          <Card className="border-red-200">
            <h2 className="font-semibold text-red-800">Zona Berbahaya</h2>
            <p className="mt-1 text-sm text-slate-600">
              Menghapus world akan menghapus seluruh artikel, relasi, template, kategori, dan
              media di dalamnya. Tindakan ini tidak dapat dibatalkan.
            </p>
            <form action={deleteWorld} className="mt-3 space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="konfirmasi" value="ya" className="h-4 w-4 accent-red-700" required />
                Saya yakin ingin menghapus world ini beserta semua isinya.
              </label>
              <Button type="submit" variant="danger">
                Hapus World Secara Permanen
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}

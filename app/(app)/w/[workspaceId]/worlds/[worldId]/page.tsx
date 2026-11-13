import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { getMemberRole, ROLE_RANK } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Textarea } from "@/components/ui";

export default async function WorldDashboardPage({
  params,
}: {
  params: Promise<{ workspaceId: string; worldId: string }>;
}) {
  const { workspaceId, worldId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const world = await prisma.world.findUnique({
    where: { id: worldId },
    include: {
      workspace: { select: { id: true, name: true } },
      _count: { select: { articles: true, media: true, templates: true, categories: true } },
    },
  });
  if (!world || world.workspaceId !== workspaceId) notFound();

  const myRole = await getMemberRole(workspaceId, user.userId);
  if (!myRole) {
    return (
      <Card>
        <h1 className="text-lg font-bold text-slate-900">Tidak ada akses</h1>
        <p className="mt-1 text-sm text-slate-600">
          Anda bukan anggota workspace world ini.
        </p>
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

  const [wordAgg, recentArticles, karakterCount, lokasiCount] = await Promise.all([
    prisma.article.aggregate({ where: { worldId }, _sum: { wordCount: true } }),
    prisma.article.findMany({
      where: { worldId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        template: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.article.count({
      where: {
        worldId,
        OR: [
          { template: { name: { equals: "Karakter", mode: "insensitive" } } },
          { category: { name: { equals: "Karakter", mode: "insensitive" } } },
        ],
      },
    }),
    prisma.article.count({
      where: {
        worldId,
        OR: [
          { template: { name: { equals: "Lokasi", mode: "insensitive" } } },
          { category: { name: { equals: "Lokasi", mode: "insensitive" } } },
        ],
      },
    }),
  ]);
  const totalWords = wordAgg._sum.wordCount ?? 0;

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
    const isPublic = formData.get("isPublic") === "on";
    if (!name) return;
    await prisma.world.update({
      where: { id: worldId },
      data: { name, description: description || null, genre: genre || null, tags, isPublic },
    });
    revalidatePath(`/w/${workspaceId}/worlds/${worldId}`);
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

  const basePath = `/w/${workspaceId}/worlds/${worldId}`;

  return (
    <div>
      <PageHeader
        title={world.name}
        desc={world.description ?? world.workspace.name}
        actions={
          <>
            {world.isPublic ? <Badge tone="emerald">Publik</Badge> : <Badge>Privat</Badge>}
            {world.genre && <Badge tone="sky">{world.genre}</Badge>}
            <Button href={`/w/${workspaceId}`} variant="secondary">
              ← Workspace
            </Button>
            <Button href={`${basePath}/settings`} variant="secondary">
              Pengaturan
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card>
          <p className="text-sm text-slate-500">Artikel</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{world._count.articles}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Kata</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{totalWords.toLocaleString("id-ID")}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Template</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{world._count.templates}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Karakter</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{karakterCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Lokasi</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{lokasiCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Media</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{world._count.media}</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Artikel Terbaru</h2>
          {recentArticles.length === 0 ? (
            <EmptyState
              title="Belum ada artikel"
              desc="Tulis artikel pertama untuk world ini dari halaman Artikel."
              action={<Button href={`${basePath}/articles`}>Buka Artikel</Button>}
            />
          ) : (
            <div className="space-y-3">
              {recentArticles.map((a) => (
                <Card key={a.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{a.title}</p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {a.template?.name ?? a.category?.name ?? "Tanpa template"} ·{" "}
                        {a.wordCount.toLocaleString("id-ID")} kata
                      </p>
                    </div>
                    <Badge tone={a.status === "PUBLISHED" ? "emerald" : a.status === "DRAFT" ? "amber" : "slate"}>
                      {a.status === "PUBLISHED" ? "Terbit" : a.status === "DRAFT" ? "Draft" : "Privat"}
                    </Badge>
                  </div>
                </Card>
              ))}
              <Link href={`${basePath}/articles`} className="text-sm font-medium text-emerald-700 hover:underline">
                Lihat semua artikel →
              </Link>
            </div>
          )}

          <Card className="mt-6">
            <h3 className="font-semibold text-slate-900">Link Cepat</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button href={`${basePath}/articles`} variant="secondary">Artikel</Button>
              <Button href={`${basePath}/templates`} variant="secondary">Template</Button>
              <Button href={`${basePath}/media`} variant="secondary">Media</Button>
              <Button href={`${basePath}/export`} variant="secondary">Ekspor</Button>
            </div>
            {world.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {world.tags.map((t) => (
                  <Badge key={t} tone="slate">{t}</Badge>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div>
          {canManage ? (
            <Card>
              <h3 className="font-semibold text-slate-900">Edit World</h3>
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
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="isPublic" defaultChecked={world.isPublic} className="h-4 w-4 accent-emerald-700" />
                  Publikasikan world ini (dapat dilihat publik)
                </label>
                <Button type="submit">Simpan Perubahan</Button>
              </form>
            </Card>
          ) : (
            <Card>
              <h3 className="font-semibold text-slate-900">Tentang World Ini</h3>
              <p className="mt-2 text-sm text-slate-600">
                {world.description ?? "Belum ada deskripsi."}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Genre: {world.genre ?? "—"} · Status: {world.isPublic ? "Publik" : "Privat"}
              </p>
            </Card>
          )}

          {isOwner && (
            <Card className="mt-4 border-red-200">
              <h3 className="font-semibold text-red-800">Hapus World</h3>
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
                  Hapus World
                </Button>
              </form>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

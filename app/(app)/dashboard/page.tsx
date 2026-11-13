import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";

async function createWorkspace(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return;
  const ws = await prisma.workspace.create({
    data: {
      name,
      description: description || undefined,
      ownerId: user.userId,
      members: { create: { userId: user.userId, role: "OWNER" } },
    },
  });
  redirect(`/w/${ws.id}`);
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const workspaces = await prisma.workspace.findMany({
    where: {
      OR: [{ ownerId: user.userId }, { members: { some: { userId: user.userId } } }],
    },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { worlds: true } } },
  });
  const wsIds = workspaces.map((w) => w.id);

  const [worldCount, articleCount, publishedCount, publicWorldCount, recentWorlds] =
    await Promise.all([
      prisma.world.count({ where: { workspaceId: { in: wsIds } } }),
      prisma.article.count({ where: { createdById: user.userId } }),
      prisma.article.count({ where: { createdById: user.userId, status: "PUBLISHED" } }),
      prisma.world.count({ where: { workspaceId: { in: wsIds }, isPublic: true } }),
      prisma.world.findMany({
        where: { workspaceId: { in: wsIds } },
        orderBy: { updatedAt: "desc" },
        take: 6,
        include: {
          workspace: { select: { name: true } },
          _count: { select: { articles: true } },
        },
      }),
    ]);

  const checklist = [
    { label: "Buat workspace", done: workspaces.length > 0, href: null as string | null },
    { label: "Buat world pertama", done: worldCount > 0, href: workspaces[0] ? `/w/${workspaces[0].id}` : null },
    { label: "Buat artikel pertama", done: articleCount > 0, href: recentWorlds[0] ? `/w/${recentWorlds[0].workspaceId}/worlds/${recentWorlds[0].id}` : null },
    { label: "Terbitkan artikel atau world", done: publishedCount > 0 || publicWorldCount > 0, href: recentWorlds[0] ? `/w/${recentWorlds[0].workspaceId}/worlds/${recentWorlds[0].id}` : null },
  ];

  return (
    <div>
      <PageHeader
        title={`Selamat datang, ${user.name}`}
        desc="Ringkasan workspace, world, dan artikel Anda."
        actions={<Button href="/onboarding" variant="secondary">Pelajari Cara Kerja</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Workspace</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{workspaces.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">World</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{worldCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Artikel Saya</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{articleCount}</p>
          <p className="mt-1 text-xs text-slate-500">{publishedCount} terbit</p>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Workspace Saya</h2>
          {workspaces.length === 0 ? (
            <EmptyState
              title="Belum ada workspace"
              desc="Buat workspace pertama Anda untuk mulai membangun world."
            />
          ) : (
            <div className="space-y-3">
              {workspaces.map((ws) => (
                <Link key={ws.id} href={`/w/${ws.id}`}>
                  <Card className="transition-shadow hover:shadow-md">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{ws.name}</p>
                        {ws.description && (
                          <p className="mt-0.5 line-clamp-1 text-sm text-slate-600">{ws.description}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm text-slate-500">
                        {ws._count.worlds} world
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          <Card className="mt-4">
            <h3 className="font-semibold text-slate-900">Buat Workspace Baru</h3>
            <form action={createWorkspace} className="mt-3 space-y-3">
              <Input label="Nama workspace" name="name" required placeholder="cth. Studio Arunika" />
              <Input label="Deskripsi (opsional)" name="description" placeholder="Workspace untuk proyek…" />
              <Button type="submit">Buat Workspace</Button>
            </form>
          </Card>
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">World Terbaru</h2>
          {recentWorlds.length === 0 ? (
            <EmptyState
              title="Belum ada world"
              desc="Buat world pertama Anda dari halaman workspace."
            />
          ) : (
            <div className="space-y-3">
              {recentWorlds.map((w) => (
                <Link key={w.id} href={`/w/${w.workspaceId}/worlds/${w.id}`}>
                  <Card className="transition-shadow hover:shadow-md">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{w.name}</p>
                        <p className="mt-0.5 text-sm text-slate-500">{w.workspace.name}</p>
                      </div>
                      <span className="shrink-0 text-sm text-slate-500">
                        {w._count.articles} artikel
                      </span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          <Card className="mt-4">
            <h3 className="font-semibold text-slate-900">Checklist Memulai</h3>
            <ul className="mt-3 space-y-2">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-sm">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      item.done ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {item.done ? "✓" : "○"}
                  </span>
                  {item.href && !item.done ? (
                    <Link href={item.href} className="text-slate-700 hover:underline">
                      {item.label}
                    </Link>
                  ) : (
                    <span className={item.done ? "text-slate-500 line-through" : "text-slate-700"}>
                      {item.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

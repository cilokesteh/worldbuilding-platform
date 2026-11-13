import type { Role } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { getMemberRole, requireRole, ROLE_LABEL, ROLE_RANK, ROLES } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Textarea } from "@/components/ui";

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      worlds: {
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { articles: true } } },
      },
      members: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  if (!workspace) notFound();

  const myRole = await getMemberRole(workspaceId, user.userId);
  if (!myRole) {
    return (
      <Card>
        <h1 className="text-lg font-bold text-slate-900">Tidak ada akses</h1>
        <p className="mt-1 text-sm text-slate-600">
          Anda bukan anggota workspace ini. Minta Owner atau Admin untuk mengundang Anda.
        </p>
        <div className="mt-4">
          <Button href="/dashboard" variant="secondary">
            Kembali ke Dashboard
          </Button>
        </div>
      </Card>
    );
  }

  const canEditWorld = ROLE_RANK[myRole] >= ROLE_RANK.EDITOR;
  const canManageMembers = ROLE_RANK[myRole] >= ROLE_RANK.ADMIN;
  const isOwner = myRole === "OWNER";

  async function createWorld(formData: FormData) {
    "use server";
    const me = await getSessionUser();
    if (!me) redirect("/login");
    try {
      await requireRole(workspaceId, me.userId, "EDITOR");
    } catch {
      return;
    }
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const genre = String(formData.get("genre") ?? "").trim();
    if (!name) return;
    await prisma.world.create({
      data: {
        workspaceId,
        name,
        description: description || undefined,
        genre: genre || undefined,
      },
    });
    revalidatePath(`/w/${workspaceId}`);
  }

  async function inviteMember(formData: FormData) {
    "use server";
    const me = await getSessionUser();
    if (!me) redirect("/login");
    try {
      await requireRole(workspaceId, me.userId, "ADMIN");
    } catch {
      return;
    }
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const roleRaw = String(formData.get("role") ?? "VIEWER");
    const role = ROLES.includes(roleRaw as Role) ? (roleRaw as Role) : "VIEWER";
    if (!email) return;
    const target = await prisma.user.findUnique({ where: { email } });
    if (!target) return;
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { ownerId: true } });
    if (!ws || target.id === ws.ownerId) return;
    const existing = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: target.id } },
    });
    if (existing) return;
    await prisma.workspaceMember.create({ data: { workspaceId, userId: target.id, role } });
    revalidatePath(`/w/${workspaceId}`);
  }

  async function changeRole(formData: FormData) {
    "use server";
    const me = await getSessionUser();
    if (!me) redirect("/login");
    try {
      await requireRole(workspaceId, me.userId, "ADMIN");
    } catch {
      return;
    }
    const targetId = String(formData.get("userId") ?? "");
    const roleRaw = String(formData.get("role") ?? "");
    if (!ROLES.includes(roleRaw as Role)) return;
    const target = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetId } },
    });
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { ownerId: true } });
    if (!target || !ws || target.userId === ws.ownerId || target.role === "OWNER") return;
    await prisma.workspaceMember.update({
      where: { id: target.id },
      data: { role: roleRaw as Role },
    });
    revalidatePath(`/w/${workspaceId}`);
  }

  async function removeMember(formData: FormData) {
    "use server";
    const me = await getSessionUser();
    if (!me) redirect("/login");
    try {
      await requireRole(workspaceId, me.userId, "ADMIN");
    } catch {
      return;
    }
    const targetId = String(formData.get("userId") ?? "");
    const target = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetId } },
    });
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { ownerId: true } });
    if (!target || !ws || target.userId === ws.ownerId || target.role === "OWNER") return;
    await prisma.workspaceMember.delete({ where: { id: target.id } });
    revalidatePath(`/w/${workspaceId}`);
  }

  return (
    <div>
      <PageHeader
        title={workspace.name}
        desc={workspace.description ?? `Owner: ${workspace.owner.name}`}
        actions={
          <>
            <Badge tone={isOwner ? "emerald" : "slate"}>Role saya: {ROLE_LABEL[myRole]}</Badge>
            <Button href="/dashboard" variant="secondary">
              ← Dashboard
            </Button>
          </>
        }
      />

      <h2 className="mb-3 text-lg font-semibold text-slate-900">World di Workspace Ini</h2>
      {workspace.worlds.length === 0 ? (
        <EmptyState
          title="Belum ada world"
          desc="Buat world pertama untuk workspace ini."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspace.worlds.map((w) => (
            <Link key={w.id} href={`/w/${workspaceId}/worlds/${w.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900">{w.name}</p>
                  {w.isPublic && <Badge tone="emerald">Publik</Badge>}
                </div>
                {w.genre && (
                  <p className="mt-1">
                    <Badge tone="sky">{w.genre}</Badge>
                  </p>
                )}
                {w.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">{w.description}</p>
                )}
                <p className="mt-3 text-sm text-slate-500">{w._count.articles} artikel</p>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {canEditWorld && (
        <Card className="mt-6">
          <h3 className="font-semibold text-slate-900">Buat World Baru</h3>
          <form action={createWorld} className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input label="Nama world" name="name" required placeholder="cth. Arunika" />
            <Input label="Genre (opsional)" name="genre" placeholder="cth. Fantasi" />
            <div className="sm:col-span-2">
              <Textarea label="Deskripsi (opsional)" name="description" rows={2} placeholder="Gambaran singkat dunia ini…" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Buat World</Button>
            </div>
          </form>
        </Card>
      )}

      <h2 className="mt-8 mb-3 text-lg font-semibold text-slate-900">
        Anggota ({workspace.members.length})
      </h2>
      <Card>
        <ul className="divide-y divide-slate-100">
          {workspace.members.map((m) => {
            const isWorkspaceOwner = m.userId === workspace.ownerId;
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-slate-900">
                    {m.user.name}
                    {m.userId === user.userId && " (Anda)"}
                  </p>
                  <p className="text-sm text-slate-500">{m.user.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={isWorkspaceOwner ? "emerald" : "slate"}>{ROLE_LABEL[m.role]}</Badge>
                  {canManageMembers && !isWorkspaceOwner && (
                    <>
                      <form action={changeRole} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={m.userId} />
                        <Select name="role" defaultValue={m.role} aria-label="Ubah role">
                          {ROLES.filter((r) => r !== "OWNER").map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </Select>
                        <Button type="submit" variant="secondary">
                          Ubah Role
                        </Button>
                      </form>
                      <form action={removeMember}>
                        <input type="hidden" name="userId" value={m.userId} />
                        <Button type="submit" variant="danger">
                          Hapus
                        </Button>
                      </form>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {canManageMembers && (
        <Card className="mt-4">
          <h3 className="font-semibold text-slate-900">Undang Anggota</h3>
          <p className="mt-1 text-sm text-slate-600">
            Pengguna harus sudah terdaftar. Masukkan email dan role awal mereka.
          </p>
          <form action={inviteMember} className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <Input label="Email" type="email" name="email" required placeholder="nama@email.com" />
            </div>
            <div className="w-44">
              <Select label="Role" name="role" defaultValue="VIEWER">
                {ROLES.filter((r) => r !== "OWNER").map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Undang</Button>
          </form>
        </Card>
      )}
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser, destroySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function logoutAction() {
  "use server";
  await destroySession();
  redirect("/login");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const workspaces = await prisma.workspace.findMany({
    where: {
      OR: [{ ownerId: user.userId }, { members: { some: { userId: user.userId } } }],
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-200 px-5 py-4">
          <Link href="/dashboard" className="text-base font-bold text-slate-900">
            ✦ Worldbuilding
          </Link>
          <p className="text-xs text-slate-500">Platform Fase 1 MVP</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <Link
            href="/dashboard"
            className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Dashboard
          </Link>
          <Link
            href="/onboarding"
            className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Onboarding
          </Link>
          <p className="px-3 pt-4 pb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Workspace Saya
          </p>
          {workspaces.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-500">Belum ada workspace.</p>
          ) : (
            workspaces.map((ws) => (
              <Link
                key={ws.id}
                href={`/w/${ws.id}`}
                className="block truncate rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                title={ws.name}
              >
                {ws.name}
              </Link>
            ))
          )}
        </nav>
        <div className="border-t border-slate-200 px-5 py-3">
          <p className="truncate text-sm font-medium text-slate-800">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="text-base font-bold text-slate-900 md:hidden">
            ✦ Worldbuilding
          </Link>
          <span className="hidden text-sm text-slate-600 md:block">Halo, {user.name}</span>
          <nav className="flex gap-1 md:hidden">
            <Link href="/dashboard" className="rounded-lg px-2 py-1 text-sm text-slate-700 hover:bg-slate-100">
              Dashboard
            </Link>
            <Link href="/onboarding" className="rounded-lg px-2 py-1 text-sm text-slate-700 hover:bg-slate-100">
              Onboarding
            </Link>
          </nav>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Keluar
            </button>
          </form>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { excerptOf } from "@/lib/markdown";
import { Badge, Card } from "@/components/ui";

export default async function PublicWorldPage({
  params,
}: {
  params: Promise<{ worldId: string }>;
}) {
  const { worldId } = await params;

  const world = await prisma.world.findUnique({
    where: { id: worldId },
    include: {
      articles: {
        where: { status: "PUBLISHED" },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          content: true,
          excerpt: true,
          updatedAt: true,
          template: { select: { name: true } },
          category: { select: { name: true } },
        },
      },
      _count: {
        select: { categories: true, relationships: true, media: true },
      },
    },
  });

  if (!world || !world.isPublic) notFound();

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-bold text-slate-900">
            ✦ Worldbuilding Platform
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Daftar Gratis
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="max-w-3xl">
          <div className="flex flex-wrap gap-2">
            {world.genre && <Badge tone="emerald">{world.genre}</Badge>}
            {world.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
          <h1 className="mt-3 text-4xl font-bold text-slate-900">{world.name}</h1>
          {world.description && (
            <p className="mt-3 text-lg text-slate-600">{world.description}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-4 text-sm text-slate-600">
            <span>
              <strong className="text-slate-900">{world.articles.length}</strong> artikel terbit
            </span>
            <span>
              <strong className="text-slate-900">{world._count.categories}</strong> kategori
            </span>
            <span>
              <strong className="text-slate-900">{world._count.relationships}</strong> relasi
            </span>
            <span>
              <strong className="text-slate-900">{world._count.media}</strong> media
            </span>
          </div>
        </div>

        <h2 className="mt-12 text-xl font-bold text-slate-900">Artikel</h2>
        {world.articles.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Dunia ini belum menerbitkan artikel apa pun.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {world.articles.map((a) => (
              <Card key={a.id}>
                <div className="flex flex-wrap gap-2">
                  {a.template && <Badge tone="sky">{a.template.name}</Badge>}
                  {a.category && <Badge>{a.category.name}</Badge>}
                </div>
                <Link
                  href={`/publik/${world.id}/artikel/${a.slug}`}
                  className="mt-2 block text-base font-semibold text-slate-900 hover:text-emerald-700 hover:underline"
                >
                  {a.title}
                </Link>
                <p className="mt-1 text-sm text-slate-600">
                  {a.excerpt ?? excerptOf(a.content)}
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  Diperbarui{" "}
                  {new Date(a.updatedAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-12 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="font-semibold text-slate-900">
            Suka dunia ini? Bangun duniamu sendiri — gratis.
          </p>
          <Link
            href="/register"
            className="mt-3 inline-block rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            Daftar Gratis
          </Link>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 text-sm text-slate-500">
          <span>Worldbuilding Platform — Fase 1 MVP</span>
          <span>Semua fitur gratis</span>
        </div>
      </footer>
    </div>
  );
}

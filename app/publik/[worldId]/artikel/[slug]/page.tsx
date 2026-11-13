import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { renderMarkdown } from "@/lib/markdown";
import { renderWikiLinks } from "@/lib/autolink";
import { Badge } from "@/components/ui";

export default async function PublicArticlePage({
  params,
}: {
  params: Promise<{ worldId: string; slug: string }>;
}) {
  const { worldId, slug } = await params;

  const world = await prisma.world.findUnique({
    where: { id: worldId },
    select: { id: true, name: true, isPublic: true },
  });
  if (!world || !world.isPublic) notFound();

  const article = await prisma.article.findFirst({
    where: { worldId, slug, status: "PUBLISHED" },
    include: {
      template: { select: { name: true } },
      category: { select: { name: true } },
    },
  });
  if (!article) notFound();

  // Peta judul -> URL publik, untuk mengubah [[Judul]] menjadi tautan.
  const published = await prisma.article.findMany({
    where: { worldId, status: "PUBLISHED" },
    select: { title: true, slug: true },
  });
  const byTitle = new Map<string, string>(
    published.map((a) => [a.title, `/publik/${worldId}/artikel/${a.slug}`]),
  );
  const html = renderWikiLinks(renderMarkdown(article.content), byTitle);

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

      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href={`/publik/${worldId}`}
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          ← Kembali ke {world.name}
        </Link>

        <div className="mt-4 flex flex-wrap gap-2">
          {article.template && <Badge tone="sky">{article.template.name}</Badge>}
          {article.category && <Badge>{article.category.name}</Badge>}
          <Badge tone="emerald">Terbit</Badge>
        </div>

        <h1 className="mt-3 text-3xl leading-tight font-bold text-slate-900 sm:text-4xl">
          {article.title}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Bagian dari dunia{" "}
          <Link href={`/publik/${worldId}`} className="font-medium text-emerald-700 hover:underline">
            {world.name}
          </Link>{" "}
          · Diperbarui{" "}
          {new Date(article.updatedAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {article.wordCount > 0 && ` · ${article.wordCount} kata`}
        </p>

        <article
          className="prose mt-8 max-w-none text-slate-800 [&_a]:text-emerald-700 [&_a]:underline [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_img]:rounded-lg [&_img]:border [&_img]:border-slate-200 [&_p]:my-3 [&_table]:w-full [&_table]:text-sm"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <div className="mt-10 border-t border-slate-200 pt-6">
          <Link
            href={`/publik/${worldId}`}
            className="inline-block rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
          >
            ← Kembali ke {world.name}
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

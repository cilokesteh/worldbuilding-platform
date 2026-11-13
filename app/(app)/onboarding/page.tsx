import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { ROLE_RANK, getMemberRole } from "@/lib/permissions";
import { ARUNIKA, BUILTIN_TEMPLATES } from "@/lib/seed-data";
import { slugify, uniqueSlug } from "@/lib/slug";
import { excerptOf, wordCount } from "@/lib/markdown";
import { Badge, Button, Card, PageHeader } from "@/components/ui";

const MODULES: { name: string; desc: string }[] = [
  {
    name: "Akun",
    desc: "Daftar gratis dengan email dan kata sandi, lalu verifikasi email Anda. Semua fitur terbuka tanpa subscription.",
  },
  {
    name: "Workspace",
    desc: "Ruang kerja untuk satu tim atau satu proyek. Satu akun bisa punya banyak workspace, masing-masing dengan anggotanya sendiri.",
  },
  {
    name: "World",
    desc: "Satu dunia = satu semesta cerita. Isi nama, deskripsi, genre, dan tag, lalu atur apakah dunia ini publik atau privat.",
  },
  {
    name: "Artikel",
    desc: "Tulis ensiklopedia duniamu dengan editor Markdown: draft, terbit, privat, plus riwayat versi setiap perubahan.",
  },
  {
    name: "Template",
    desc: "26 template bawaan — Karakter, Lokasi, Organisasi, Spesies, Mantra, dan lainnya — atau buat template sendiri dengan field kustom.",
  },
  {
    name: "Relasi",
    desc: "Hubungkan dua artikel dengan relasi berjenis: Keluarga, Rivalitas, Anggota, Menjaga, dan tipe kustom lainnya.",
  },
  {
    name: "Pencarian",
    desc: "Cari artikel, lokasi, dan tokoh di seluruh dunia dari satu kolom pencarian global.",
  },
  {
    name: "Media",
    desc: "Unggah gambar, PDF, dan file teks (maks 6 MB per file) ke galeri dunia, lalu sisipkan ke artikel dengan sintaks Markdown.",
  },
  {
    name: "Publikasi",
    desc: "Terbitkan dunia ke halaman publik yang bisa dibaca siapa pun tanpa login, lengkap dengan daftar artikel terbit.",
  },
  {
    name: "Import / Export",
    desc: "Ekspor satu dunia atau seluruh data akun sebagai JSON, dan impor kembali kapan pun. Datamu milikmu sepenuhnya.",
  },
];

/** Buat dunia contoh Arunika (dipakai server action di bawah). */
async function createArunika(workspaceId: string, userId: string) {
  const existing = await prisma.world.findFirst({
    where: { workspaceId, name: ARUNIKA.name },
    select: { id: true },
  });
  if (existing) {
    throw new Error(`Dunia "${ARUNIKA.name}" sudah ada di workspace ini.`);
  }

  const world = await prisma.world.create({
    data: {
      workspaceId,
      name: ARUNIKA.name,
      description: ARUNIKA.description,
      genre: ARUNIKA.genre,
      tags: ARUNIKA.tags,
      isPublic: false,
    },
  });

  const categoryByName = new Map<string, string>();
  for (const name of ARUNIKA.categories) {
    const created = await prisma.category.create({
      data: { worldId: world.id, name },
    });
    categoryByName.set(name, created.id);
  }

  const templateByName = new Map<string, string>();
  for (const name of new Set(ARUNIKA.articles.map((a) => a.template))) {
    const builtin = await prisma.template.findFirst({
      where: { worldId: null, name },
      select: { id: true },
    });
    if (builtin) {
      templateByName.set(name, builtin.id);
      continue;
    }
    const def = BUILTIN_TEMPLATES.find((t) => t.name === name);
    const created = await prisma.template.create({
      data: {
        worldId: world.id,
        name,
        description: def?.description ?? null,
        fields: (def?.fields ?? []) as Prisma.InputJsonValue,
        isBuiltIn: false,
      },
    });
    templateByName.set(name, created.id);
  }

  const takenSlugs = new Set<string>();
  const articleByTitle = new Map<string, string>();
  for (const a of ARUNIKA.articles) {
    const slug = uniqueSlug(slugify(a.title), takenSlugs);
    takenSlugs.add(slug);
    const created = await prisma.article.create({
      data: {
        worldId: world.id,
        templateId: templateByName.get(a.template) ?? null,
        categoryId: categoryByName.get(a.category) ?? null,
        title: a.title,
        slug,
        content: a.content,
        fieldValues: {},
        excerpt: excerptOf(a.content),
        status: "PUBLISHED",
        wordCount: wordCount(a.content),
        createdById: userId,
      },
    });
    articleByTitle.set(a.title, created.id);
  }

  for (const r of ARUNIKA.relationships) {
    const fromId = articleByTitle.get(r.from);
    const toId = articleByTitle.get(r.to);
    if (!fromId || !toId) continue;
    await prisma.relationship.create({
      data: {
        worldId: world.id,
        fromArticleId: fromId,
        toArticleId: toId,
        type: r.type,
      },
    });
  }
  return world;
}

async function loadExample(formData: FormData) {
  "use server";
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const workspaceId = String(formData.get("workspaceId") ?? "");
  if (!workspaceId) redirect("/onboarding?contoh=gagal&pesan=" + encodeURIComponent("Pilih workspace dulu."));

  let outcome: { status: "ok" | "gagal"; worldId?: string; pesan?: string };
  try {
    const role = await getMemberRole(workspaceId, user.userId);
    if (!role || ROLE_RANK[role] < ROLE_RANK.EDITOR) {
      throw new Error("Memuat dunia contoh butuh peran Editor atau lebih tinggi.");
    }
    const world = await createArunika(workspaceId, user.userId);
    outcome = { status: "ok", worldId: world.id };
  } catch (e) {
    outcome = {
      status: "gagal",
      pesan: e instanceof Error ? e.message : "Gagal memuat dunia contoh.",
    };
  }

  if (outcome.status === "ok") {
    redirect(`/onboarding?contoh=ok&world=${outcome.worldId}&ws=${workspaceId}`);
  }
  redirect(
    "/onboarding?contoh=gagal&pesan=" + encodeURIComponent(outcome.pesan ?? "Gagal memuat dunia contoh."),
  );
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ contoh?: string; pesan?: string; world?: string; ws?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const sp = (await searchParams) ?? {};

  const owned = await prisma.workspace.findMany({
    where: { ownerId: user.userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.userId },
    include: { workspace: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const workspaces = [
    ...owned,
    ...memberships.map((m) => m.workspace),
  ].filter((w, i, arr) => arr.findIndex((x) => x.id === w.id) === i);
  const workspaceIds = workspaces.map((w) => w.id);

  const [worlds, articlesCount, invitedCount] = await Promise.all([
    prisma.world.findMany({
      where: { workspaceId: { in: workspaceIds } },
      select: { id: true, name: true, workspaceId: true, isPublic: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.article.count({ where: { createdById: user.userId } }),
    workspaceIds.length > 0
      ? prisma.workspaceMember.count({ where: { workspaceId: { in: workspaceIds } } })
      : Promise.resolve(0),
  ]);

  const checklist = [
    {
      label: "Buat workspace",
      desc: "Ruang kerja pertama Anda — tempat semua dunia tinggal.",
      done: workspaces.length > 0,
      href: "/dashboard",
    },
    {
      label: "Buat world",
      desc: "Buat dunia pertama, atau muat contoh dunia Arunika di bawah.",
      done: worlds.length > 0,
      href: "/dashboard",
    },
    {
      label: "Tulis artikel pertama",
      desc: "Satu artikel tentang tokoh, lokasi, atau apa pun di duniamu.",
      done: articlesCount > 0,
      href: worlds[0] ? `/w/${worlds[0].workspaceId}/worlds/${worlds[0].id}` : "/dashboard",
    },
    {
      label: "Undang anggota",
      desc: "Ajak rekan menulis ke workspace Anda.",
      done: invitedCount > 0,
      href: "/dashboard",
    },
    {
      label: "Terbitkan dunia",
      desc: "Ubah satu dunia menjadi publik agar bisa dibaca siapa pun.",
      done: worlds.some((w) => w.isPublic),
      href: worlds[0] ? `/w/${worlds[0].workspaceId}/worlds/${worlds[0].id}` : "/dashboard",
    },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-8">
      <PageHeader
        title={`Selamat datang, ${user.name}!`}
        desc="Mulai membangun dunia Anda dalam lima langkah. Semuanya gratis — tanpa subscription, tanpa paywall."
      />

      {sp.contoh === "ok" && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Dunia contoh Arunika berhasil dibuat — 7 artikel dan 6 relasi siap dipelajari.{" "}
          {sp.world && sp.ws && (
            <Link href={`/w/${sp.ws}/worlds/${sp.world}`} className="font-medium underline">
              Buka dunia Arunika →
            </Link>
          )}
        </p>
      )}
      {sp.contoh === "gagal" && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {sp.pesan ? decodeURIComponent(sp.pesan) : "Gagal memuat dunia contoh."}
        </p>
      )}

      <Card className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Memulai</h2>
          <Badge tone={doneCount === checklist.length ? "emerald" : "slate"}>
            {doneCount} dari {checklist.length} selesai
          </Badge>
        </div>
        <ul className="mt-4 space-y-3">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  c.done ? "bg-emerald-600 text-white" : "border border-slate-300 bg-white text-slate-400"
                }`}
              >
                {c.done ? "✓" : "·"}
              </span>
              <div className="flex-1">
                <p className={`text-sm font-medium ${c.done ? "text-slate-500 line-through" : "text-slate-900"}`}>
                  {c.label}
                </p>
                <p className="text-xs text-slate-500">{c.desc}</p>
              </div>
              {!c.done && (
                <Link href={c.href} className="shrink-0 text-xs font-medium text-emerald-700 hover:underline">
                  Buka →
                </Link>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mb-6">
        <h2 className="text-base font-semibold text-slate-900">Muat contoh dunia Arunika</h2>
        <p className="mt-1 text-sm text-slate-600">
          Belum punya gambaran? Muat dunia contoh Arunika: kepulauan yang diterangi dua matahari
          kembar, dengan 7 artikel (karakter, lokasi, organisasi, konflik) dan 6 relasi. Anda bisa
          mengedit atau menghapusnya kapan pun.
        </p>
        {workspaces.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            Buat workspace dulu dari{" "}
            <Link href="/dashboard" className="font-medium text-emerald-700 hover:underline">
              dashboard
            </Link>
            , lalu kembali ke sini untuk memuat Arunika.
          </p>
        ) : (
          <form action={loadExample} className="mt-4 flex flex-wrap items-end gap-3">
            <label className="block flex-1">
              <span className="mb-1 block text-sm font-medium text-slate-700">Workspace tujuan</span>
              <select
                name="workspaceId"
                defaultValue={workspaces[0]?.id}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit">Muat contoh dunia Arunika</Button>
          </form>
        )}
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-slate-900">Pusat bantuan — modul Fase 1</h2>
        <p className="mt-1 text-sm text-slate-600">
          Sepuluh modul yang tersedia di Fase 1, semuanya gratis.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {MODULES.map((m) => (
            <div key={m.name} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">{m.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{m.desc}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Butuh bantuan lebih lanjut? Semua data Anda dapat diekspor kapan pun dari halaman
          Ekspor &amp; Impor di tiap dunia.
        </p>
      </Card>
    </div>
  );
}

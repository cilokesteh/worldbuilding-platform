import Link from "next/link";
import { getSessionUser } from "@/lib/auth";

export default async function LandingPage() {
  const user = await getSessionUser();
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-bold text-slate-900">
            ✦ Worldbuilding Platform
          </Link>
          <nav className="flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden text-sm text-slate-600 sm:inline">Halo, {user.name}</span>
                <Link
                  href="/dashboard"
                  className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                >
                  Buka Dashboard
                </Link>
              </>
            ) : (
              <>
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
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold tracking-wide text-emerald-700 uppercase">
            Worldbuilding &amp; Creative IP Management
          </p>
          <h1 className="mt-3 text-4xl leading-tight font-bold text-slate-900 sm:text-5xl">
            Bangun dunia Anda. Dokumentasikan segalanya.
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Ruang kerja terpadu untuk penulis, ilustrator, studio game, dan Game Master RPG: wiki
            artikel dengan template, relasi antarentitas, media, dan publikasi — semuanya dalam satu
            tempat, dan semuanya gratis.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={user ? "/dashboard" : "/register"}
              className="rounded-lg bg-emerald-700 px-6 py-3 text-sm font-medium text-white hover:bg-emerald-800"
            >
              {user ? "Buka Dashboard" : "Mulai Membangun — Gratis"}
            </Link>
            <Link
              href="/onboarding"
              className="rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Lihat Cara Kerja
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Tanpa subscription · Tanpa paywall · Tanpa iklan · Data Anda dapat diekspor kapan pun
          </p>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Wiki & Artikel",
              desc: "Tulis ensiklopedia dunia dengan editor Markdown, daftar isi otomatis, draft & terbit, dan riwayat versi.",
            },
            {
              title: "26 Template Bawaan",
              desc: "Karakter, lokasi, organisasi, spesies, mantra, teknologi, dan lainnya — plus custom template builder.",
            },
            {
              title: "Auto-linking & Relasi",
              desc: "Nama entitas terdeteksi otomatis di dalam teks, jadi tautan [[...]] dengan backlink. Relasi keluarga, aliansi, musuh, dan kustom.",
            },
            {
              title: "Workspace & Tim",
              desc: "Satu workspace untuk banyak dunia, dengan 6 role (Owner sampai Viewer) dan permission per anggota.",
            },
            {
              title: "Media Library",
              desc: "Upload gambar dan file ke galeri dunia, lalu sisipkan ke artikel. Validasi tipe dan ukuran file.",
            },
            {
              title: "Publikasi & Ekspor",
              desc: "Terbitkan dunia ke halaman publik, dan ekspor seluruh data Anda sebagai JSON atau Markdown kapan pun.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <h2 className="text-lg font-bold text-slate-900">Contoh dunia: Arunika</h2>
          <p className="mt-1 text-sm text-slate-600">
            Kepulauan yang diterangi dua matahari kembar, tempat paus langit berenang di antara awan
            dan Suar Karang Emas menjadi penanda pulang para pelaut. Daftar, lalu muat contoh dunia
            ini dari onboarding — 7 artikel dan 6 relasi siap dipelajari dan diedit.
          </p>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500">
          <span>Worldbuilding Platform — Fase 1 MVP</span>
          <span>Dibangun oleh CilokTech Studio · Semua fitur gratis</span>
        </div>
      </footer>
    </div>
  );
}

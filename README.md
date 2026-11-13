# Worldbuilding Platform

Platform **worldbuilding & creative IP management** ala World Anvil — bangun
dunia fiksi, dokumentasikan setiap tokoh, lokasi, organisasi, dan relasinya,
lalu terbitkan untuk dibaca siapa pun. **Semua fitur gratis, tanpa
subscription, tanpa paywall, tanpa iklan.** Data Anda dapat diekspor kapan pun.

Dibangun oleh CilokTech Studio · Fase 1 MVP.

---

## Fitur Fase 1

| Modul | Isi |
| --- | --- |
| **Akun** | Register/login email + kata sandi, session JWT (cookie `httpOnly`, 30 hari), verifikasi email & reset kata sandi (link saat ini di-log ke console server — belum ada SMTP). |
| **Workspace** | Banyak workspace per akun, 6 role (Owner, Admin, Editor, Kontributor, Reviewer, Viewer) dengan permission per anggota. |
| **World** | Banyak dunia per workspace: nama, deskripsi, genre, tag, publik/privat. |
| **Artikel** | Editor Markdown, status Draft / Published / Private, excerpt & word count otomatis, riwayat versi, komentar. |
| **Template** | 26 template bawaan (Character, Location, Organization, Species, Spell, dan lainnya) + custom template builder dengan field dinamis. |
| **Relasi** | Relasi berjenis antarartikel (Keluarga, Rivalitas, Anggota, Menjaga, kustom) dengan pencegahan duplikat. |
| **Auto-linking** | Nama entitas terdeteksi di dalam teks dan disarankan sebagai tautan wiki `[[Nama]]` dengan backlink. |
| **Pencarian** | Pencarian global artikel di seluruh dunia dalam workspace. |
| **Media** | Galeri media per dunia: gambar, PDF, teks (maks 6 MB/file, disimpan base64 di database), sisipkan ke artikel dengan sintaks Markdown. |
| **Publikasi** | Halaman publik per dunia (`/publik/[worldId]`) dan per artikel (`/publik/[worldId]/artikel/[slug]`) — bisa dibaca tanpa login. |
| **Import / Export** | Ekspor satu dunia atau seluruh data akun sebagai JSON; impor kembali sebagai dunia baru. |
| **Onboarding** | Checklist getting started + pusat bantuan + muat dunia contoh **Arunika** (7 artikel, 6 relasi) dengan satu klik. |

---

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Prisma 6** + **PostgreSQL**
- **JWT** (`jose`) + **bcryptjs** untuk auth
- **marked** untuk render Markdown (dengan sanitasi HTML)

Tidak ada layanan berbayar yang wajib: database gratis (Neon), hosting gratis
(Vercel), media disimpan di database (tanpa S3/Blob).

---

## Cara jalan lokal

### Prasyarat

- Node.js 20+
- PostgreSQL lokal (atau database Neon gratis — lihat `DEPLOY.md`)

### Langkah

```bash
# 1. Salin contoh env dan isi
cp .env.example .env
# Isi di .env:
#   DATABASE_URL=postgresql://user:password@localhost:5432/worldbuilding
#   JWT_SECRET=<string acak panjang>

# 2. Install dependensi (postinstall menjalankan prisma generate)
npm install

# 3. Buat tabel dari skema Prisma
npx prisma db push

# 4. Isi 26 template bawaan
npx prisma db seed

# 5. Jalankan dev server
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000). Daftar akun baru, buat
workspace, lalu muat dunia contoh Arunika dari halaman onboarding.

Generate `JWT_SECRET` dengan:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> Jangan commit file `.env` berisi kredensial asli. `.env.example` hanya
> berisi placeholder.

---

## Struktur folder (singkat)

```
app/
  page.tsx                    # Landing page
  (app)/
    onboarding/page.tsx       # Checklist + pusat bantuan + contoh Arunika
    w/[workspaceId]/worlds/[worldId]/
      media/page.tsx          # Galeri media
      export/page.tsx         # Ekspor & impor
  publik/[worldId]/           # Halaman publik dunia + artikel
    artikel/[slug]/page.tsx
  api/
    worlds/[worldId]/
      media/                  # Upload/daftar media + file bytes
      export/route.ts         # Ekspor JSON dunia
      import/route.ts         # Impor JSON dunia
      example/route.ts        # Buat dunia contoh Arunika
    account/export/route.ts   # Ekspor seluruh data akun
components/
  ui.tsx                      # Button, Input, Card, Badge, dll.
lib/
  prisma.ts auth.ts permissions.ts   # DB, session JWT, role
  slug.ts markdown.ts autolink.ts    # Utilitas
  seed-data.ts                # 26 template bawaan + dunia Arunika
prisma/
  schema.prisma               # Skema database
  seed.ts                     # Seed template bawaan
DEPLOY.md                     # Panduan deploy ke Vercel
```

---

## Catatan free-tier

- **Database:** Neon free tier (~0,5 GB, project tidur bila idle — request
  pertama setelah tidur butuh beberapa detik).
- **Hosting:** Vercel Hobby — auto-deploy dari `git push` ke branch production.
- **Media:** disimpan sebagai base64 di PostgreSQL, maks 6 MB per file.
  Bukan untuk hosting file besar — kompres gambar sebelum upload.
- **Email:** verifikasi & reset kata sandi saat ini hanya mencetak link ke
  log console server. Pasang SMTP bila perlu pengiriman email sungguhan.
- **Skema:** memakai `prisma db push` (tanpa file migrasi) di Fase 1.
  Beralih ke `prisma migrate` bila kolaborasi skema sudah ramai.

## Lisensi

Proyek internal CilokTech Studio — Fase 1 MVP.

# Deploy — Worldbuilding Platform (Fase 1 MVP)

Panduan deploy aplikasi Next.js 15 (App Router) ini ke **Vercel** dengan database
PostgreSQL gratis. Semua layanan di bawah ini punya free tier — operasional
Rp 0/bulan untuk skala MVP.

---

## 1. Buat database PostgreSQL gratis

Pilih salah satu:

### Opsi A — Neon (disarankan)

1. Buka [https://neon.tech](https://neon.tech) dan buat akun gratis.
2. Buat project baru (region terdekat: Singapore `ap-southeast-1`).
3. Di dashboard Neon, buka **Connection Details** dan salin **connection string**,
   contoh bentuknya:
   `postgresql://<user>:<password>@<host>/<database>?sslmode=require`
4. Simpan string ini — dipakai sebagai `DATABASE_URL` di langkah 3.

Free tier Neon: 1 project, penyimpanan ~0,5 GB, cukup untuk MVP. Database
otomatis tidur setelah beberapa menit tidak dipakai (cold start beberapa detik
pada request pertama — wajar di free tier).

### Opsi B — Vercel Postgres / Neon integration

1. Di dashboard Vercel, buka **Storage → Create Database → Neon Postgres**
   (atau Postgres bila tersedia di region Anda).
2. Pilih project Vercel Anda saat diminta — Vercel otomatis mengisi
   `DATABASE_URL` di environment variables project tersebut.
3. Lewati langkah 3a bila memakai opsi ini.

> Jangan commit connection string ke repo. String itu berisi password database.

---

## 2. Import repo ke Vercel

1. Push repo ini ke GitHub (atau GitLab/Bitbucket).
2. Buka [https://vercel.com/new](https://vercel.com/new) → **Import** repo ini.
3. Framework terdeteksi otomatis sebagai **Next.js** — biarkan semua pengaturan
   build apa adanya:
   - Build Command: `next build` (default)
   - Output Directory: default Next.js
   - Install Command: `npm install` (default; `postinstall` menjalankan
     `prisma generate` otomatis)
4. **Jangan deploy dulu** — isi environment variables di langkah 3.

---

## 3. Set environment variables di Vercel

Di halaman import (atau **Project → Settings → Environment Variables**), isi
untuk environment **Production** (dan Preview bila perlu):

| Variabel | Isi |
| --- | --- |
| `DATABASE_URL` | Connection string PostgreSQL dari langkah 1. Bila memakai Neon, pastikan ada `?sslmode=require` di akhir string. |
| `JWT_SECRET` | String acak panjang untuk menandatangani session JWT. Generate dengan: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` lalu tempel hasilnya. Jangan pakai ulang secret dari proyek lain. |

Tidak ada variabel lain yang wajib di Fase 1.

---

## 4. Deploy

1. Klik **Deploy** dan tunggu build selesai.
2. Buka URL hasil deploy (mis. `https://namaproject.vercel.app`) — halaman
   landing harus terbuka. Login/register **belum akan berfungsi** sampai
   langkah 5 selesai (tabel database belum ada).

---

## 5. Migrasi skema dari lokal (sekali, setelah deploy pertama)

Skema dibuat dengan Prisma. Jalankan dari mesin lokal Anda — **jangan**
menjalankan perintah ini di dashboard Vercel:

```bash
# 1. Salin .env.example ke .env, isi DATABASE_URL dengan connection string
#    yang SAMA dengan yang dipakai di Vercel, lalu:
DATABASE_URL="<connection-string-vercel>" npx prisma db push

# 2. Isi template bawaan (26 template) ke database production:
DATABASE_URL="<connection-string-vercel>" npx prisma db seed
```

Catatan:

- `prisma db push` menyinkronkan `prisma/schema.prisma` ke database tanpa
  file migrasi — cukup untuk MVP. Bila nanti beralih ke migrasi formal,
  ganti dengan `prisma migrate deploy`.
- `prisma db seed` menjalankan `prisma/seed.ts` (template bawaan). Aman
  dijalankan ulang — memakai `upsert` berdasarkan id template.
- Setelah langkah ini, register/login di URL Vercel akan berfungsi. Uji dengan
  membuat akun, workspace, lalu muat dunia contoh Arunika dari halaman
  onboarding.

---

## 6. Catatan penting

- **Tidak perlu env `PRISMA_*` di Vercel.** Prisma engine (query engine)
  diunduh otomatis saat build (`postinstall` menjalankan `prisma generate`).
  Variabel `PRISMA_QUERY_ENGINE_LIBRARY` / `PRISMA_SCHEMA_ENGINE_BINARY`
  hanya dipakai untuk dev lokal di VM tertentu — kosongkan di Vercel.
- **Tidak perlu `vercel.json`.** Next.js terdeteksi otomatis oleh Vercel;
  tidak ada konfigurasi build kustom di Fase 1.
- **Email verifikasi/reset saat ini hanya log link ke console server**
  (belum ada SMTP). Pengguna tetap bisa register dan login; link verifikasi
  tercetak di log server. Bila nanti dipasang SMTP, tambahkan env `SMTP_*`
  dan sesuaikan pengirim email di kode auth.
- **Batas upload media 6 MB per file.** File disimpan sebagai base64 di
  kolom `MediaAsset.data` (PostgreSQL) — tanpa S3/Vercel Blob di Fase 1.
  Perhatikan ukuran database Neon free tier bila banyak mengunggah gambar
  besar; kompres gambar sebelum upload bila perlu.
- **Session:** cookie JWT `wb_session`, masa berlaku 30 hari, `httpOnly`,
  `secure` di production.
- **Node:** Vercel memakai Node 20+ secara default — sesuai prasyarat proyek.

---

## 7. Cara update (deploy ulang)

Cukup push ke branch production (default `main`):

```bash
git add -A && git commit -m "pesan perubahan" && git push
```

Vercel auto-deploy setiap push ke branch production. Perubahan skema Prisma
(`prisma/schema.prisma`) perlu diikuti `prisma db push` dari lokal seperti
langkah 5 — deploy kode saja tidak mengubah tabel database.

---

## 8. Troubleshooting

| Gejala | Penyebab umum / solusi |
| --- | --- |
| Halaman 500 saat register/login | Tabel belum dibuat — ulangi langkah 5; periksa `DATABASE_URL` di Vercel (harus sama dengan yang dipakai saat `db push`). |
| `JWT_SECRET belum diset` di log | Env `JWT_SECRET` belum diset di Vercel → Settings → Environment Variables → tambahkan → **Redeploy**. |
| Koneksi database timeout / SSL error | Neon butuh `?sslmode=require` di `DATABASE_URL`; periksa juga apakah project Neon sedang tidur (coba lagi setelah beberapa detik). |
| Build gagal di `prisma generate` | Pastikan `prisma` ada di `dependencies` (bukan hanya devDependencies) — sudah demikian di `package.json`. |
| Upload media gagal di atas 6 MB | Batas disengaja (validasi API). Kompres file atau bagi menjadi beberapa file. |

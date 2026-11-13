"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";

function ResetContent() {
  const params = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!token) {
      setError("Token reset tidak ditemukan.");
      return;
    }
    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    if (password !== confirm) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Gagal mengatur ulang password.");
        return;
      }
      setDone(true);
    } catch {
      setError("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Card>
        <h1 className="text-xl font-bold text-slate-900">Link reset tidak valid</h1>
        <p className="mt-1 text-sm text-slate-600">
          Token reset tidak ditemukan di link ini. Minta link reset baru dari halaman lupa password.
        </p>
        <div className="mt-5">
          <Button href="/forgot" className="w-full">
            Minta Link Baru
          </Button>
        </div>
      </Card>
    );
  }

  if (done) {
    return (
      <Card>
        <h1 className="text-xl font-bold text-slate-900">Password berhasil diubah ✓</h1>
        <p className="mt-1 text-sm text-slate-600">
          Password baru Anda sudah aktif. Silakan masuk dengan password baru.
        </p>
        <div className="mt-5">
          <Button href="/login" className="w-full">
            Masuk
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-xl font-bold text-slate-900">Atur Ulang Password</h1>
      <p className="mt-1 text-sm text-slate-600">Masukkan password baru untuk akun Anda.</p>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <Input label="Password Baru" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 8 karakter" autoComplete="new-password" />
        <Input label="Konfirmasi Password Baru" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Ulangi password baru" autoComplete="new-password" />
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Memproses…" : "Simpan Password Baru"}
        </Button>
      </form>
    </Card>
  );
}

export default function ResetPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-lg font-bold text-slate-900">
          ✦ Worldbuilding Platform
        </Link>
        <Suspense
          fallback={
            <Card>
              <h1 className="text-xl font-bold text-slate-900">Memuat…</h1>
            </Card>
          }
        >
          <ResetContent />
        </Suspense>
      </div>
    </div>
  );
}

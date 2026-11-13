"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button, Card, Input } from "@/components/ui";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Gagal memproses permintaan.");
        return;
      }
      setSent(true);
    } catch {
      setError("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-lg font-bold text-slate-900">
          ✦ Worldbuilding Platform
        </Link>
        <Card>
          <h1 className="text-xl font-bold text-slate-900">Lupa Password</h1>
          <p className="mt-1 text-sm text-slate-600">
            Masukkan email akun Anda. Kami akan mengirim link untuk mengatur ulang password.
          </p>
          {sent ? (
            <div className="mt-5 rounded-lg bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
              Jika email tersebut terdaftar, link reset password sudah dikirim. Periksa kotak masuk
              Anda (di MVP ini link tercatat di log server karena SMTP belum tersedia).
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" autoComplete="email" />
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Memproses…" : "Kirim Link Reset"}
              </Button>
            </form>
          )}
          <p className="mt-5 text-center text-sm text-slate-600">
            <Link href="/login" className="font-medium text-emerald-700 hover:underline">
              Kembali ke Halaman Masuk
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

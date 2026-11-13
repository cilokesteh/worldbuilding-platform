"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Gagal mendaftar.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
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
          <h1 className="text-xl font-bold text-slate-900">Daftar Gratis</h1>
          <p className="mt-1 text-sm text-slate-600">
            Buat akun dan workspace pribadi Anda. Semua fitur gratis, tanpa subscription.
          </p>
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <Input label="Nama" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama Anda" autoComplete="name" />
            <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" autoComplete="email" />
            <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimal 8 karakter" autoComplete="new-password" />
            <Input label="Konfirmasi Password" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Ulangi password" autoComplete="new-password" />
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Memproses…" : "Buat Akun"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-slate-600">
            Sudah punya akun?{" "}
            <Link href="/login" className="font-medium text-emerald-700 hover:underline">
              Masuk
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

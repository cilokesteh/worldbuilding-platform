"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Gagal masuk.");
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
          <h1 className="text-xl font-bold text-slate-900">Masuk</h1>
          <p className="mt-1 text-sm text-slate-600">Masuk ke akun Anda untuk melanjutkan membangun dunia.</p>
          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" autoComplete="email" />
            <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Memproses…" : "Masuk"}
            </Button>
          </form>
          <div className="mt-5 flex items-center justify-between text-sm">
            <Link href="/forgot" className="font-medium text-emerald-700 hover:underline">
              Lupa password?
            </Link>
            <Link href="/register" className="font-medium text-emerald-700 hover:underline">
              Belum punya akun? Daftar
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

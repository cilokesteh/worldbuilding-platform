"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Card } from "@/components/ui";

function VerifyContent() {
  const params = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Token verifikasi tidak ditemukan.");
      return;
    }
    fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Verifikasi gagal.");
        setState("success");
      })
      .catch((err: unknown) => {
        setState("error");
        setMessage(err instanceof Error ? err.message : "Verifikasi gagal.");
      });
  }, [token]);

  return (
    <Card>
      {state === "loading" && (
        <>
          <h1 className="text-xl font-bold text-slate-900">Memverifikasi email…</h1>
          <p className="mt-1 text-sm text-slate-600">Mohon tunggu sebentar.</p>
        </>
      )}
      {state === "success" && (
        <>
          <h1 className="text-xl font-bold text-slate-900">Email terverifikasi ✓</h1>
          <p className="mt-1 text-sm text-slate-600">
            Alamat email Anda sudah terverifikasi. Selamat membangun dunia!
          </p>
          <div className="mt-5">
            <Button href="/dashboard" className="w-full">
              Buka Dashboard
            </Button>
          </div>
        </>
      )}
      {state === "error" && (
        <>
          <h1 className="text-xl font-bold text-slate-900">Verifikasi gagal</h1>
          <p className="mt-1 text-sm text-slate-600">{message}</p>
          <p className="mt-2 text-sm text-slate-600">
            Link verifikasi mungkin sudah kedaluwarsa atau sudah pernah dipakai.
          </p>
          <div className="mt-5">
            <Button href="/login" className="w-full">
              Kembali ke Halaman Masuk
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 block text-center text-lg font-bold text-slate-900">
          ✦ Worldbuilding Platform
        </Link>
        <Suspense
          fallback={
            <Card>
              <h1 className="text-xl font-bold text-slate-900">Memverifikasi email…</h1>
              <p className="mt-1 text-sm text-slate-600">Mohon tunggu sebentar.</p>
            </Card>
          }
        >
          <VerifyContent />
        </Suspense>
      </div>
    </div>
  );
}

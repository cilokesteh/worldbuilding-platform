import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Worldbuilding Platform — Bangun Dunia, Dokumentasikan IP",
  description:
    "Platform worldbuilding & manajemen IP kreatif: wiki artikel, template karakter, relasi antarentitas, media, dan publikasi. Semua fitur gratis, tanpa subscription.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-[#f6f5f2] text-slate-900 antialiased`}>
        {children}
      </body>
    </html>
  );
}

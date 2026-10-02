// AuthLayout — Bingkai bersama halaman login (guru & admin).
// Kartu form di tengah + foto gedung sebagai background redup.
// Pemakaian: <AuthLayout badge="Portal Guru">...logo, judul, form...</AuthLayout>
// Logika login tetap di masing-masing page — komponen ini murni tampilan.
import Image from 'next/image'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode // isi kartu: logo, judul, form, error
  badge: string // teks kecil di bawah kartu, mis. "Portal Guru"
}

export default function AuthLayout({ children, badge }: Props) {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
      {/* Background foto gedung + overlay gelap agar kartu terbaca */}
      <Image
        src="/gedung-sekolah.jpg"
        alt="Gedung SMK Bagimu Negeriku"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[3px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950/70" />
      <div className="relative w-full max-w-md">
        {/* Kartu dark gray glassmorphism: fokus utama di atas foto */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#1e293b]/85 p-8 shadow-[0_24px_70px_-12px_rgba(0,0,0,0.8),0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl sm:p-10">
          {/* Kilau halus di atas kartu */}
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
          {children}
        </div>
        <p className="mt-6 text-center text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-100">
          {badge} • SMK Bagimu Negeriku
        </p>
      </div>
    </div>
  )
}

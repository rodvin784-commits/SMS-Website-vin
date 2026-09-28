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
      <div className="absolute inset-0 bg-slate-950/75" />
      <div className="relative w-full max-w-md">
        <div className="rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
          {children}
        </div>
        <p className="mt-5 text-center text-[11px] font-semibold tracking-wide text-slate-300">
          {badge} • SMK Bagimu Negeriku
        </p>
      </div>
    </div>
  )
}

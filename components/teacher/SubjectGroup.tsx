'use client'

// SubjectGroup — Satu kartu mata pelajaran berisi pill kelas-kelas yang diampu.
// Dipakai di: app/teacher/dashboard/page.tsx (grid) — data real dari guru_kelas + jadwal.

import { BookOpen } from 'lucide-react'
import type { GuruAssignment } from '@/components/teacher/AssignmentCard'
import { AssignmentCard } from './AssignmentCard'

type MapelGroup = {
  mapel_id: string
  mapel_nama: string | null
  mapel_kode: string | null
  kelas: GuruAssignment[]
}

interface SubjectGroupProps {
  group: MapelGroup
  sesiPerMinggu?: number // jumlah sesi jadwal/minggu (dari /api/teacher/jadwal)
  tampilSesi?: boolean // false = sembunyikan pill status (halaman tanpa data jadwal)
}

export function SubjectGroup({ group, sesiPerMinggu = 0, tampilSesi = true }: SubjectGroupProps) {
  const tahunAjaran = Array.from(
    new Set(group.kelas.map((k) => k.tahun_ajaran).filter((t): t is string => !!t))
  )
  // Satu baris abu-abu: "PKD • T.A. 2026/2027" (bagian yang kosong dibuang)
  const subline = [group.mapel_kode, ...tahunAjaran.map((ta) => `T.A. ${ta}`)]
    .filter((s): s is string => !!s)
    .join(' • ')

  return (
    <article className="flex flex-col rounded-xl border border-gray-100 bg-gray-50/70 p-4">
      {/* Kepala kartu: judul kiri, status kanan */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100/80 text-emerald-700">
            <BookOpen className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-gray-900">{group.mapel_nama ?? 'Mata Pelajaran'}</h3>
            {subline && <p className="mt-0.5 truncate text-xs font-medium text-gray-500">{subline}</p>}
          </div>
        </div>
        {tampilSesi && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100/90 px-2.5 py-1 text-[11px] font-bold text-amber-800">
            {sesiPerMinggu > 0 ? `${sesiPerMinggu} sesi/minggu` : 'Belum ada jadwal'}
          </span>
        )}
      </div>

      {/* Daftar kelas */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {group.kelas.map((a) => (
          <AssignmentCard key={a.id} assignment={a} />
        ))}
      </div>
    </article>
  )
}

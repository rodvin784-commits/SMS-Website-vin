'use client'

// AssignmentCard — Pill kelas kecil di dalam kartu mata pelajaran.
// Modern: rounded-full dengan latar lembut (bukan kotak kaku).

export type GuruAssignment = {
  id: string
  mata_pelajaran_id: string
  mapel_nama: string | null
  mapel_kode: string | null
  kelas_id: string
  kelas_nama: string | null
  tingkat: number | null
  tahun_ajaran: string | null
}

interface AssignmentCardProps {
  assignment: GuruAssignment
}

export function AssignmentCard({ assignment }: AssignmentCardProps) {
  const label = assignment.kelas_nama ?? 'Kelas —'
  const title = assignment.tahun_ajaran ? `${label} • T.A. ${assignment.tahun_ajaran}` : label
  return (
    <span
      title={title}
      className="inline-flex max-w-full items-center rounded-full bg-emerald-100/80 px-3 py-1 text-xs font-bold text-emerald-800"
    >
      <span className="truncate">{label}</span>
    </span>
  )
}

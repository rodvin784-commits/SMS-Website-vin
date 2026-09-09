'use client'

import { BookOpen } from 'lucide-react'

export type GuruAssignment = {
  id: string
  mapel_id: string
  mapel_nama: string | null
  mapel_kode: string | null
  kelas_id: string
  kelas_nama: string | null
  materi: string | null
}

interface AssignmentCardProps {
  assignment: GuruAssignment
}

export function AssignmentCard({ assignment }: AssignmentCardProps) {
  return (
    <div className="inline-flex flex-col rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
      <span className="text-sm font-bold text-gray-900">{assignment.kelas_nama}</span>
      {assignment.materi && (
        <span className="text-xs text-gray-500">Materi: {assignment.materi}</span>
      )}
    </div>
  )
}

'use client'

export type GuruAssignment = {
  id: string
  mapel_id: string
  mapel_nama: string | null
  mapel_kode: string | null
  kelas_id: string
  kelas_nama: string | null
  tingkat: number | null
  tahun_ajaran: string | null
  semester: string | null
  materi: string | null
}

interface AssignmentCardProps {
  assignment: GuruAssignment
}

export function AssignmentCard({ assignment }: AssignmentCardProps) {
  const semesterLabel =
    assignment.semester === 'genap' ? 'Semester Genap' : 'Semester Ganjil'
  return (
    <div className="inline-flex flex-col rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2">
      <span className="text-sm font-bold text-gray-900">{assignment.kelas_nama}</span>
      <span className="text-xs text-gray-400">
        {semesterLabel}
        {assignment.tahun_ajaran ? ` · ${assignment.tahun_ajaran}` : ''}
      </span>
      {assignment.materi && (
        <span className="text-xs text-gray-500">Materi: {assignment.materi}</span>
      )}
    </div>
  )
}

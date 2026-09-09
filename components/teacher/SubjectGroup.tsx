'use client'

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
}

export function SubjectGroup({ group }: SubjectGroupProps) {
  return (
    <div>
      <div className="flex items-center space-x-2 mb-2">
        <BookOpen className="h-4 w-4 text-emerald-600" />
        <h3 className="font-bold text-gray-900">{group.mapel_nama}</h3>
        {group.mapel_kode && (
          <span className="text-xs font-semibold text-gray-400 uppercase">
            {group.mapel_kode}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {group.kelas.map((a) => (
          <AssignmentCard key={a.id} assignment={a} />
        ))}
      </div>
    </div>
  )
}

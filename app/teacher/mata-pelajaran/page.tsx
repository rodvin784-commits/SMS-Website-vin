'use client'

import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { teacherNavItems } from '@/lib/teacher-nav'
import { BookOpen } from 'lucide-react'
import { SubjectGroup } from '@/components/teacher'
import { useTeacherAuth } from '@/hooks/useTeacherAuth'

type GuruAssignment = {
  id: string
  mata_pelajaran_id: string
  mapel_nama: string | null
  mapel_kode: string | null
  kelas_id: string
  kelas_nama: string | null
  tingkat: number | null
  tahun_ajaran: string | null
}

type MapelGroup = {
  mapel_id: string
  mapel_nama: string | null
  mapel_kode: string | null
  kelas: GuruAssignment[]
}

export default function TeacherMapelPage() {
  const { loading, teacherName, handleLogout } = useTeacherAuth()
  const [assignments, setAssignments] = useState<GuruAssignment[]>([])

  useEffect(() => {
    if (loading) return
    let cancelled = false

    async function loadAssignments() {
      try {
        const res = await fetch('/api/teacher/mengajar')
        if (res.ok && !cancelled) {
          const data = await res.json().catch(() => null)
          setAssignments(data?.assignments ?? [])
        }
      } catch (err) {
        console.error('Gagal memuat penugasan mengajar:', err)
      }
    }

    void loadAssignments()

    return () => {
      cancelled = true
    }
  }, [loading])

  const mapelGroups = useMemo(() => {
    const groups = new Map<string, MapelGroup>()
    for (const a of assignments) {
      let g = groups.get(a.mata_pelajaran_id)
      if (!g) {
        g = {
          mapel_id: a.mata_pelajaran_id,
          mapel_nama: a.mapel_nama,
          mapel_kode: a.mapel_kode,
          kelas: [],
        }
        groups.set(a.mata_pelajaran_id, g)
      }
      g.kelas.push(a)
    }
    return Array.from(groups.values())
  }, [assignments])

  const totalKelas = useMemo(
    () => new Set(assignments.map((a) => a.kelas_id)).size,
    [assignments]
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-600">Memuat Panel Guru...</p>
        </div>
      </div>
    )
  }

  return (
    <AppShell
      role="teacher"
      userName={teacherName}
      navItems={teacherNavItems}
      onLogout={handleLogout}
      logoIcon={<BookOpen className="h-6 w-6 text-emerald-400" />}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Mata Pelajaran</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            {mapelGroups.length} mata pelajaran · {totalKelas} kelas yang Anda ampu.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          {assignments.length === 0 ? (
            <div className="p-10 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-50 mb-4">
                <BookOpen className="h-10 w-10 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Belum ada penugasan</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Admin belum mengatur mata pelajaran dan kelas untuk Anda. Silakan hubungi admin
                sekolah.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {mapelGroups.map((group) => (
                <SubjectGroup key={group.mapel_id} group={group} tampilSesi={false} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

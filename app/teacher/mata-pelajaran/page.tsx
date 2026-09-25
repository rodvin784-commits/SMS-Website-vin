'use client'

import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { teacherNavItems } from '@/lib/teacher-nav'
import { BookOpen } from 'lucide-react'
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
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        <div className="flex flex-col items-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-400">Memuat Panel Guru...</p>
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
          <p className="text-sm text-gray-500 mt-1">
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
            <div className="space-y-6">
              {mapelGroups.map((group) => (
                <div key={group.mapel_id} className="border-b border-gray-100 last:border-0 pb-5 last:pb-0">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                      <BookOpen className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{group.mapel_nama}</h3>
                      {group.mapel_kode && (
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
                          {group.mapel_kode}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.kelas.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-2.5 w-full sm:w-auto min-w-[200px]"
                      >
                        <p className="text-sm font-bold text-gray-900">{a.kelas_nama}</p>
                        <p className="text-xs text-gray-400">
                          {a.tahun_ajaran ? `T.A. ${a.tahun_ajaran}` : '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}

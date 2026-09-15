'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import { BookOpen, Calendar, ClipboardList, FileText, LayoutDashboard, Video } from 'lucide-react'

type GuruAssignment = {
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

type MapelGroup = {
  mapel_id: string
  mapel_nama: string | null
  mapel_kode: string | null
  kelas: GuruAssignment[]
}

const navItems = [
  { href: '/teacher/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/teacher/mata-pelajaran', icon: BookOpen, label: 'Mata Pelajaran' },
  { href: '/teacher/materi', icon: Video, label: 'Materi & Video' },
  { href: '/teacher/presensi', icon: ClipboardList, label: 'Presensi Siswa' },
  { href: '/teacher/jadwal', icon: Calendar, label: 'Jadwal Mengajar' },
  { href: '/teacher/nilai', icon: FileText, label: 'Nilai Siswa' },
]

export default function TeacherMapelPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [teacherName, setTeacherName] = useState('Guru')
  const [assignments, setAssignments] = useState<GuruAssignment[]>([])

  useEffect(() => {
    let cancelled = false

    async function checkTeacherSession() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !session) {
          router.replace('/login')
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()

        if (profileError || !profile || profile.status === false || profile.role !== 'guru') {
          await supabase.auth.signOut()
          router.replace('/login')
          return
        }

        if (!cancelled) {
          setTeacherName(profile.nama_lengkap || 'Guru')
          setLoading(false)
        }

        try {
          const res = await fetch('/api/teacher/mengajar')
          if (res.ok && !cancelled) {
            const data = await res.json().catch(() => null)
            setAssignments(data?.assignments ?? [])
          }
        } catch (err) {
          console.error('Gagal memuat penugasan mengajar:', err)
        }
      } catch (err) {
        console.error('Auth check failed:', err)
        router.replace('/login')
      }
    }

    checkTeacherSession()

    return () => {
      cancelled = true
    }
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  const mapelGroups = useMemo(() => {
    const groups = new Map<string, MapelGroup>()
    for (const a of assignments) {
      let g = groups.get(a.mapel_id)
      if (!g) {
        g = {
          mapel_id: a.mapel_id,
          mapel_nama: a.mapel_nama,
          mapel_kode: a.mapel_kode,
          kelas: [],
        }
        groups.set(a.mapel_id, g)
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
      navItems={navItems}
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
                          {a.semester === 'genap' ? 'Semester Genap' : 'Semester Ganjil'}
                          {a.tahun_ajaran ? ` · ${a.tahun_ajaran}` : ''}
                        </p>
                        {a.materi && <p className="text-xs text-gray-500 mt-0.5">Materi: {a.materi}</p>}
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
'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/ui/StatCard'
import { BookOpen, GraduationCap, Calendar, ClipboardList, FileText, LayoutDashboard, UserCheck, Video } from 'lucide-react'
import { SubjectGroup } from '@/components/teacher'

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

export default function TeacherDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [teacherName, setTeacherName] = useState('Guru')
  const [assignments, setAssignments] = useState<GuruAssignment[]>([])
  const [jadwalHariIni, setJadwalHariIni] = useState<string | number>('--')
  const [presensiTerkirim, setPresensiTerkirim] = useState<string | number>('--')
  type WaliKelasInfo = { nama_kelas: string; tingkat: number; tahun_ajaran: string; jurusan_nama: string | null }
  const [waliKelas, setWaliKelas] = useState<WaliKelasInfo | null>(null)

  useEffect(() => {
    let cancelled = false

    async function checkTeacherSession() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('Session error:', sessionError)
          router.replace('/login')
          return
        }

        if (!session) {
          router.replace('/login')
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()

        if (profileError || !profile) {
          console.error('Profile query error:', profileError)
          await supabase.auth.signOut()
          router.replace('/login')
          return
        }

        if (profile.status === false) {
          await supabase.auth.signOut()
          router.replace('/login')
          return
        }

        if (profile.role !== 'guru') {
          await supabase.auth.signOut()
          router.replace('/login')
          return
        }

        if (!cancelled) {
          const name = profile.nama_lengkap || 'Guru'
          setTeacherName(name)
          setLoading(false)
        }

        // Muat penugasan mengajar (mapel & kelas) milik guru ini
        try {
          const res = await fetch('/api/teacher/mengajar')
          if (res.ok && !cancelled) {
            const data = await res.json().catch(() => null)
            setAssignments(data?.assignments ?? [])
            setPresensiTerkirim(data?.presensi_terkirim ?? 0)
            setWaliKelas((data?.wali_kelas ?? null) as WaliKelasInfo | null)
          }
        } catch (err) {
          console.error('Gagal memuat penugasan mengajar:', err)
        }

        // Muat jadwal untuk menghitung jumlah sesi hari ini
        try {
          const res = await fetch('/api/teacher/jadwal')
          if (res.ok && !cancelled) {
            const data = await res.json().catch(() => null)
            const today = new Date().getDay() // 0= Minggu ... 6 = Sabtu
            const count = (data?.jadwal ?? []).filter((e: { hari: number }) => e.hari === today).length
            setJadwalHariIni(count)
          }
        } catch (err) {
          console.error('Gagal memuat jadwal:', err)
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

  // Kelompokkan penugasan per mata pelajaran
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

  const mapelCount = mapelGroups.length
  const kelasCount = useMemo(
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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Dashboard Guru</h1>
          <p className="text-sm text-gray-500 mt-1">Selamat datang kembali, {teacherName}.</p>
          {waliKelas && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-bold text-emerald-700">
              <UserCheck className="h-3.5 w-3.5" />
              Wali Kelas {waliKelas.tingkat} {waliKelas.nama_kelas}
            </div>
          )}
        </div>

        {/* Grid Statistik */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={BookOpen}
            label="Mata Pelajaran"
            value={mapelCount > 0 ? mapelCount : '--'}
            variant="emerald"
            delay={0}
          />
          <StatCard
            icon={GraduationCap}
            label="Kelas Diajar"
            value={kelasCount > 0 ? kelasCount : '--'}
            variant="blue"
            delay={100}
          />
          <StatCard
            icon={Calendar}
            label="Jadwal Hari Ini"
            value={jadwalHariIni}
            variant="amber"
            delay={200}
          />
          <StatCard
            icon={ClipboardList}
            label="Presensi Diperiksa"
            value={presensiTerkirim}
            variant="purple"
            delay={300}
          />
        </div>

        {/* Mata Pelajaran & Kelas yang Diampu */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-2">
            Mata Pelajaran & Kelas yang Anda Ampu
          </h2>
          {assignments.length === 0 ? (
            <p className="text-sm text-gray-500">
              Admin belum mengatur mata pelajaran dan kelas untuk Anda. Silakan hubungi admin
              sekolah.
            </p>
          ) : (
            <div className="space-y-5">
              {mapelGroups.map((group) => (
                <SubjectGroup key={group.mapel_id} group={group} />
              ))}
            </div>
          )}
        </div>

        {/* Wali Kelas */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-emerald-600" />
            Wali Kelas
          </h2>
          {waliKelas ? (
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <UserCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-gray-900">
                  Kelas {waliKelas.tingkat} {waliKelas.nama_kelas}
                </p>
                <p className="text-sm text-gray-500">
                  {waliKelas.jurusan_nama ? `${waliKelas.jurusan_nama} · ` : ''}Tahun Ajaran {waliKelas.tahun_ajaran}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Anda belum ditunjuk sebagai wali kelas.</p>
          )}
        </div>
      </div>
    </AppShell>
  )
}

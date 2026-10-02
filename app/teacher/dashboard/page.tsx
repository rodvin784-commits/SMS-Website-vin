'use client'

import { useEffect, useState, useMemo } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { StatCard } from '@/components/ui/StatCard'
import { teacherNavItems } from '@/lib/teacher-nav'
import { BookOpen, Calendar, ClipboardCheck, FileText, GraduationCap, UserCheck } from 'lucide-react'
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

const HARI_KODE: Record<string, number> = {
  Senin: 1,
  Selasa: 2,
  Rabu: 3,
  Kamis: 4,
  Jumat: 5,
  Sabtu: 6,
}

export default function TeacherDashboard() {
  const { loading, teacherName, handleLogout } = useTeacherAuth()
  const [assignments, setAssignments] = useState<GuruAssignment[]>([])
  const [jadwalHariIni, setJadwalHariIni] = useState<string | number>('--')
  const [tugasAktif, setTugasAktif] = useState<string | number>('--')
  const [jadwalList, setJadwalList] = useState<{ hari: string; mata_pelajaran_id: string }[]>([])
  const [waliKelas, setWaliKelas] = useState<{
    kelas_id: string
    nama_kelas: string | null
    tingkat: number | null
    tahun_ajaran: string | null
  } | null>(null)

  useEffect(() => {
    if (loading) return
    let cancelled = false

    async function loadDashboardData() {
      // Penugasan + wali kelas (opsional)
      try {
        const res = await fetch('/api/teacher/mengajar')
        if (res.ok && !cancelled) {
          const data = await res.json().catch(() => null)
          setAssignments(data?.assignments ?? [])
          setWaliKelas(data?.wali_kelas ?? null)
        }
      } catch (err) {
        console.error('Gagal memuat penugasan mengajar:', err)
      }

      // Jadwal hari ini + simpan daftar untuk hitungan sesi per mapel
      try {
        const res = await fetch('/api/teacher/jadwal')
        if (res.ok && !cancelled) {
          const data = await res.json().catch(() => null)
          const list = ((data?.jadwal ?? []) as { hari: string; mata_pelajaran_id: string }[])
          if (cancelled) return
          setJadwalList(list)
          const todayIndex = new Date().getDay() // 0=Minggu..6=Sabtu
          const count = list.filter(
            (e) => HARI_KODE[e.hari] === todayIndex
          ).length
          setJadwalHariIni(count)
        }
      } catch (err) {
        console.error('Gagal memuat jadwal:', err)
      }

      // Tugas aktif (published) milik guru
      try {
        const res = await fetch('/api/teacher/tugas')
        if (res.ok && !cancelled) {
          const data = await res.json().catch(() => null)
          const count = ((data?.tugas ?? []) as { status: string }[]).filter(
            (t) => t.status === 'published'
          ).length
          setTugasAktif(count)
        }
      } catch (err) {
        console.error('Gagal memuat tugas:', err)
      }
    }

    void loadDashboardData()

    return () => {
      cancelled = true
    }
  }, [loading])

  // Kelompokkan penugasan per mata pelajaran
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

  const kelasCount = useMemo(
    () => new Set(assignments.map((a) => a.kelas_id)).size,
    [assignments]
  )

  // Sesi jadwal per minggu per mapel (data real dari /api/teacher/jadwal)
  const sesiPerMapel = useMemo(() => {
    const m = new Map<string, number>()
    for (const j of jadwalList) {
      if (!j.mata_pelajaran_id) continue
      m.set(j.mata_pelajaran_id, (m.get(j.mata_pelajaran_id) ?? 0) + 1)
    }
    return m
  }, [jadwalList])

  // Teks konteks kartu statistik — pengenal pendek (kode) agar tidak terpotong
  const hintJadwal =
    jadwalHariIni === '--' ? null
    : jadwalHariIni === 0 ? 'Tidak ada kelas'
    : jadwalHariIni === 1 ? '1 sesi hari ini'
    : `${jadwalHariIni} sesi hari ini`
  const hintTugas =
    tugasAktif === '--' ? null
    : tugasAktif === 0 ? 'Semua beres'
    : 'Perlu dinilai'
  const hintMapel =
    mapelGroups.length === 0 ? 'Belum ada penugasan'
    : mapelGroups.length === 1
      ? (mapelGroups[0].mapel_kode ?? mapelGroups[0].mapel_nama ?? 'Mapel diampu')
      : `${mapelGroups[0].mapel_kode ?? mapelGroups[0].mapel_nama ?? 'Mapel'} +${mapelGroups.length - 1} lainnya`
  const kelasNames = useMemo(
    () => Array.from(new Set(assignments.map((a) => a.kelas_nama).filter((n): n is string => !!n))),
    [assignments]
  )
  const hintKelas =
    kelasNames.length === 0 ? 'Belum ada penugasan'
    : kelasNames.length === 1 ? kelasNames[0]
    : `${kelasNames[0]} +${kelasNames.length - 1} lainnya`

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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Dashboard Guru</h1>
          <p className="text-sm text-gray-600 mt-0.5">Selamat datang kembali, {teacherName}.</p>
          {waliKelas && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-bold text-emerald-700">
              <UserCheck className="h-3.5 w-3.5" />
              Wali Kelas {waliKelas.nama_kelas}
            </div>
          )}
        </div>

        {/* Grid Statistik */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={BookOpen}
            label="Mata Pelajaran"
            value={mapelGroups.length > 0 ? mapelGroups.length : '--'}
            hint={mapelGroups.length > 0 ? hintMapel : null}
            variant="emerald"
            delay={0}
          />
          <StatCard
            icon={GraduationCap}
            label="Kelas Diajar"
            value={kelasCount > 0 ? kelasCount : '--'}
            hint={kelasCount > 0 ? hintKelas : null}
            variant="blue"
            delay={100}
          />
          <StatCard
            icon={Calendar}
            label="Jadwal Hari Ini"
            value={jadwalHariIni}
            hint={hintJadwal}
            variant="amber"
            delay={200}
          />
          <StatCard
            icon={ClipboardCheck}
            label="Tugas Aktif"
            value={tugasAktif}
            hint={hintTugas}
            variant="purple"
            delay={300}
          />
        </div>

        {/* Mata Pelajaran & Kelas yang Diampu */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" aria-hidden />
            Mata Pelajaran & Kelas yang Anda Ampu
          </h2>
          {assignments.length === 0 ? (
            <p className="text-sm text-gray-600">
              Admin belum mengatur mata pelajaran dan kelas untuk Anda. Silakan hubungi admin
              sekolah.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {mapelGroups.map((group) => (
                <SubjectGroup
                  key={group.mapel_id}
                  group={group}
                  sesiPerMinggu={sesiPerMapel.get(group.mapel_id) ?? 0}
                />
              ))}
            </div>
          )}
        </div>

        {/* Wali Kelas (opsional — hanya muncul jika kolom wali_kelas_id tersedia) */}
        {waliKelas && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="text-base font-bold text-gray-900 mb-2 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-emerald-600" />
              Wali Kelas
            </h2>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <UserCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="font-bold text-gray-900">{waliKelas.nama_kelas}</p>
                <p className="text-sm text-gray-600">
                  Tahun Ajaran {waliKelas.tahun_ajaran ?? '—'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}

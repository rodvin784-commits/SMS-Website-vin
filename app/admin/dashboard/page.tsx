'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { StatCard } from '@/components/ui'
import { Users, GraduationCap, BookOpen, Calendar, UserPlus, ArrowRight } from 'lucide-react'

export default function AdminDashboardPage() {
  const [totalGuru, setTotalGuru] = useState<number | string>('--')
  const [totalSiswa, setTotalSiswa] = useState<number | string>('--')
  const [totalMapel, setTotalMapel] = useState<number | string>('--')
  const [totalKelas, setTotalKelas] = useState<number | string>('--')

  useEffect(() => {
    let cancelled = false

    async function fetchStats() {
      const [guruRes, siswaRes, mapelRes, kelasRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'guru'),
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'siswa'),
        supabase
          .from('mata_pelajaran')
          .select('*', { count: 'exact', head: true })
          .eq('status', true),
        supabase
          .from('kelas')
          .select('*', { count: 'exact', head: true })
          .eq('status', true),
      ])

      if (!cancelled) {
        if (guruRes.count !== null) setTotalGuru(guruRes.count)
        if (siswaRes.count !== null) setTotalSiswa(siswaRes.count)
        if (mapelRes.count !== null) setTotalMapel(mapelRes.count)
        if (kelasRes.count !== null) setTotalKelas(kelasRes.count)
      }
    }

    fetchStats()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Ringkasan Sistem</h1>
          <p className="text-sm text-gray-600">Selamat datang kembali di panel kontrol utama sekolah.</p>
        </div>
      </div>

      {/* Grid Statistik */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Users}
          label="Total Guru"
          value={totalGuru}
          variant="blue"
          delay={0}
        />
        <StatCard
          icon={GraduationCap}
          label="Total Siswa"
          value={totalSiswa}
          variant="emerald"
          delay={100}
        />
        <StatCard
          icon={BookOpen}
          label="Mata Pelajaran"
          value={totalMapel}
          variant="purple"
          delay={200}
        />
        <StatCard
          icon={Calendar}
          label="Total Kelas"
          value={totalKelas}
          variant="amber"
          delay={300}
        />
      </div>

      {/* Aksi Cepat */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-base font-bold text-gray-900 mb-1">Manajemen Cepat</h2>
        <p className="text-sm text-gray-500 mb-4">
          Akses langsung ke halaman pengelolaan data sekolah.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            href="/admin/users"
            className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 transition-all hover:border-blue-200 hover:bg-blue-50"
          >
            <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <UserPlus className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900">Pengguna</p>
              <p className="text-xs text-gray-500">Guru & siswa</p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-blue-500" />
          </Link>

          <Link
            href="/admin/mata-pelajaran"
            className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 transition-all hover:border-emerald-200 hover:bg-emerald-50"
          >
            <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900">Mata Pelajaran</p>
              <p className="text-xs text-gray-500">Mapel & penugasan</p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-emerald-500" />
          </Link>

          <Link
            href="/admin/kelas"
            className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 transition-all hover:border-purple-200 hover:bg-purple-50"
          >
            <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900">Kelas</p>
              <p className="text-xs text-gray-500">Rombongan belajar</p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-purple-500" />
          </Link>

          <Link
            href="/admin/jurusan"
            className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 transition-all hover:border-amber-200 hover:bg-amber-50"
          >
            <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900">Jurusan</p>
              <p className="text-xs text-gray-500">Program keahlian</p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-amber-500" />
          </Link>
        </div>
      </div>
    </div>
  )
}
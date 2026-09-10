'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { StatCard } from '@/components/ui'
import { Users, GraduationCap, BookOpen, Calendar } from 'lucide-react'

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

      {/* Area Konten Tambahan */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-base font-bold text-gray-900 mb-2">Aktivitas & Manajemen Cepat</h2>
        <p className="text-sm text-gray-500">
          Database dan tabel relasi telah terhubung dengan aman menggunakan sistem Row Level Security (RLS) Supabase. Anda dapat mulai menambahkan fitur manajemen data guru, siswa, serta kelas di bagian ini.
        </p>
      </div>
    </div>
  )
}
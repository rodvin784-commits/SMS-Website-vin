'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { StatCard } from '@/components/ui'
import { Users, GraduationCap, BookOpen, Calendar } from 'lucide-react'

export default function AdminDashboardPage() {
  const [totalGuru, setTotalGuru] = useState<number | string>('--')
  const [totalSiswa, setTotalSiswa] = useState<number | string>('--')

  useEffect(() => {
    async function fetchStats() {
      const { count: guruCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'guru')

      const { count: siswaCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'siswa')

      if (guruCount !== null) setTotalGuru(guruCount)
      if (siswaCount !== null) setTotalSiswa(siswaCount)
    }

    fetchStats()
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
          value="--"
          variant="purple"
          delay={200}
        />
        <StatCard
          icon={Calendar}
          label="Total Kelas"
          value="--"
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
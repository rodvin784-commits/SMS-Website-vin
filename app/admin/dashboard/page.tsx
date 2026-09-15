'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { StatCard } from '@/components/ui'
import {
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  UserPlus,
  ArrowRight,
  RefreshCw,
  Clock,
  Filter,
} from 'lucide-react'

interface KelasDist {
  tingkat: number
  count: number
  pct: number
}

interface JurusanDist {
  id: string
  nama: string
  count: number
  pct: number
}

interface KelasBaris {
  id: string
  tingkat: number
  tahun_ajaran: string
  jurusan_id: string | null
  jurusan: { id: string; kode: string; nama: string } | null
}

interface ActivityItem {
  id: string
  type: 'user' | 'kelas' | 'penugasan'
  title: string
  subtitle: string
  time: string
}

interface DashboardResponse {
  stats: {
    totalGuru: number
    totalSiswa: number
    totalMapel: number
    totalKelas: number
    totalJurusan: number
  }
  kelas: KelasBaris[]
  jurusan: { id: string; kode: string; nama: string }[]
  tahun_ajaran: string[]
  activity: ActivityItem[]
}

const activityIcon = {
  user: { icon: UserPlus, text: 'text-blue-600', bg: 'bg-blue-100' },
  kelas: { icon: GraduationCap, text: 'text-purple-600', bg: 'bg-purple-100' },
  penugasan: { icon: BookOpen, text: 'text-emerald-600', bg: 'bg-emerald-100' },
} as const

function formatRelative(time: string): string {
  const diff = Date.now() - new Date(time).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'baru saja'
  if (min < 60) return `${min} menit lalu`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} hari lalu`
  return new Date(time).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatTanggalLengkap(time: string): string {
  return new Date(time).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AdminDashboardPage() {
  const [totalGuru, setTotalGuru] = useState<number | string>('--')
  const [totalSiswa, setTotalSiswa] = useState<number | string>('--')
  const [totalMapel, setTotalMapel] = useState<number | string>('--')
  const [kelasList, setKelasList] = useState<KelasBaris[]>([])
  const [jurusanOptions, setJurusanOptions] = useState<{ id: string; kode: string; nama: string }[]>([])
  const [tahunAjaranOptions, setTahunAjaranOptions] = useState<string[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [lastUpdated, setLastUpdated] = useState<string>('--')
  const [loading, setLoading] = useState(true)

  const [tahunAjaranFilter, setTahunAjaranFilter] = useState('all')
  const [jurusanFilter, setJurusanFilter] = useState('all')

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dashboard')
      if (!res.ok) {
        throw new Error('Gagal memuat data dashboard')
      }
      const data = (await res.json()) as DashboardResponse
      setTotalGuru(data.stats.totalGuru)
      setTotalSiswa(data.stats.totalSiswa)
      setTotalMapel(data.stats.totalMapel)
      setKelasList(data.kelas)
      setJurusanOptions(data.jurusan)
      setTahunAjaranOptions(data.tahun_ajaran)
      setActivity(data.activity)
      setLastUpdated(formatTanggalLengkap(new Date().toISOString()))
    } catch (err) {
      console.error('Error fetching dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    async function init() {
      await loadData()
    }

    void init()
  }, [loadData])

  const handleRefresh = useCallback(() => {
    setLoading(true)
    void loadData()
  }, [loadData])

  const filteredKelas = useMemo(() => {
    return kelasList.filter(
      (k) =>
        (tahunAjaranFilter === 'all' || k.tahun_ajaran === tahunAjaranFilter) &&
        (jurusanFilter === 'all' || k.jurusan_id === jurusanFilter)
    )
  }, [kelasList, tahunAjaranFilter, jurusanFilter])

  const totalKelasAktif = kelasList.length

  const tingkatDistribution = useMemo((): KelasDist[] => {
    const counts: Record<number, number> = {}
    filteredKelas.forEach((k) => {
      counts[k.tingkat] = (counts[k.tingkat] ?? 0) + 1
    })
    const denom = filteredKelas.length || 1
    return ([10, 11, 12] as const).map((tingkat) => ({
      tingkat,
      count: counts[tingkat] ?? 0,
      pct: Math.round(((counts[tingkat] ?? 0) / denom) * 100),
    }))
  }, [filteredKelas])

  const jurusanDistribution = useMemo((): JurusanDist[] => {
    const map = new Map<string, JurusanDist>()
    filteredKelas.forEach((k) => {
      const id = k.jurusan_id ?? 'tanpa-jurusan'
      const nama = k.jurusan?.nama ?? 'Tanpa Jurusan'
      const existing = map.get(id)
      if (existing) {
        existing.count += 1
      } else {
        map.set(id, { id, nama, count: 1, pct: 0 })
      }
    })
    const denom = filteredKelas.length || 1
    const list = Array.from(map.values()).sort((a, b) => b.count - a.count)
    list.forEach((item) => {
      item.pct = Math.round((item.count / denom) * 100)
    })
    return list
  }, [filteredKelas])

  const maxJurusanCount = Math.max(1, ...jurusanDistribution.map((j) => j.count))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Ringkasan Sistem</h1>
          <p className="text-sm text-gray-600">Selamat datang kembali di panel kontrol utama sekolah.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Terakhir diperbarui: {lastUpdated}
          </span>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-purple-300 hover:text-purple-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Segarkan
          </button>
        </div>
      </div>

      {/* Grid Statistik */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Users} label="Guru Aktif" value={totalGuru} variant="blue" delay={0} />
        <StatCard icon={GraduationCap} label="Siswa Aktif" value={totalSiswa} variant="emerald" delay={100} />
        <StatCard icon={BookOpen} label="Mapel Aktif" value={totalMapel} variant="purple" delay={200} />
        <StatCard icon={Calendar} label="Kelas Aktif" value={loading ? '--' : totalKelasAktif} variant="amber" delay={300} />
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-gray-500" />
          <h2 className="text-base font-bold text-gray-900">Filter Distribusi Kelas</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tahun Ajaran</span>
            <select
              value={tahunAjaranFilter}
              onChange={(e) => setTahunAjaranFilter(e.target.value)}
              className="mt-1.5 w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            >
              <option value="all">Semua Tahun Ajaran</option>
              {tahunAjaranOptions.map((tahun) => (
                <option key={tahun} value={tahun}>
                  {tahun}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Jurusan</span>
            <select
              value={jurusanFilter}
              onChange={(e) => setJurusanFilter(e.target.value)}
              className="mt-1.5 w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            >
              <option value="all">Semua Jurusan</option>
              {jurusanOptions.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.kode} - {j.nama}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Distribusi */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Per Tingkat */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-base font-bold text-gray-900 mb-1">Kelas per Tingkatan</h2>
          <p className="text-sm text-gray-500 mb-5">
            Distribusi {filteredKelas.length} kelas {tahunAjaranFilter !== 'all' ? `tahun ${tahunAjaranFilter}` : ''}{' '}
            berdasarkan tingkat.
          </p>
          <div className="space-y-4">
            {tingkatDistribution.map((item) => (
              <div key={item.tingkat}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-semibold text-gray-800">Kelas {item.tingkat}</span>
                  <span className="text-gray-500">
                    {item.count} kelas · {item.pct}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-500"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
            {filteredKelas.length === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">Belum ada kelas pada filter ini.</p>
            )}
          </div>
        </div>

        {/* Per Jurusan */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-base font-bold text-gray-900 mb-1">Kelas per Jurusan</h2>
          <p className="text-sm text-gray-500 mb-5">Distribusi kelas berdasarkan jurusan (program keahlian).</p>
          <div className="space-y-4">
            {jurusanDistribution.map((item) => (
              <div key={item.id}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-semibold text-gray-800">{item.nama}</span>
                  <span className="text-gray-500">
                    {item.count} kelas · {item.pct}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
                    style={{ width: `${(item.count / maxJurusanCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {jurusanDistribution.length === 0 && (
              <p className="text-sm text-gray-400 py-6 text-center">Belum ada kelas pada filter ini.</p>
            )}
          </div>
        </div>
      </div>

      {/* Aktivitas Terbaru */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-base font-bold text-gray-900 mb-1">Aktivitas Terbaru</h2>
        <p className="text-sm text-gray-500 mb-4">Perubahan data terakhir di sistem.</p>
        {activity.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">Belum ada aktivitas.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {activity.map((item) => {
              const style = activityIcon[item.type]
              const Icon = style.icon
              return (
                <li key={item.id} className="flex items-start gap-3 py-3">
                  <div className={`h-9 w-9 flex-shrink-0 rounded-xl ${style.bg} ${style.text} flex items-center justify-center`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
                    <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatRelative(item.time)}</span>
                </li>
              )
            })}
          </ul>
        )}
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
              <p className="text-xs text-gray-500">
                <span className="font-bold text-blue-600">{loading ? '--' : totalGuru}</span> guru ·{' '}
                <span className="font-bold text-blue-600">{loading ? '--' : totalSiswa}</span> siswa
              </p>
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
              <p className="text-xs text-gray-500">
                <span className="font-bold text-emerald-600">{loading ? '--' : totalMapel}</span> mapel aktif
              </p>
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
              <p className="text-xs text-gray-500">
                <span className="font-bold text-purple-600">{loading ? '--' : totalKelasAktif}</span> kelas aktif
              </p>
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
              <p className="text-xs text-gray-500">
                <span className="font-bold text-amber-600">{loading ? '--' : jurusanOptions.length}</span> jurusan aktif
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-amber-500" />
          </Link>
        </div>
      </div>
    </div>
  )
}
'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Pencil, Trash2, GraduationCap, Filter, Search, CheckCircle2, Building2, UserCheck } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { FeedbackMessage } from '@/components/ui/FeedbackMessage'
import { useFeedback } from '@/hooks/useFeedback'

interface JurusanData {
  id: string
  kode: string
  nama: string
  status: boolean
}

interface KelasData {
  id: string
  nama_kelas: string
  tingkat: number
  tahun_ajaran: string
  jurusan_id: string | null
  jurusan: { id: string; kode: string; nama: string } | null
  wali_kelas_id: string | null
  wali_kelas_nama: string | null
  status: boolean
  created_at: string
  jumlah_siswa?: number
}

interface KelasFormData {
  nama_kelas: string
  tingkat: number
  tahun_ajaran: string
  jurusan_id: string | null
  wali_kelas_id: string | null
}

interface KelasManagerProps {
  onDataChanged?: () => void
}

export function KelasManager({ onDataChanged }: KelasManagerProps) {
  const [data, setData] = useState<KelasData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [tingkatFilter, setTingkatFilter] = useState<string>('all')
  // Filter jurusan via URL (dari badge di halaman Jurusan) dan dropdown
  const searchParams = useSearchParams()
  const [jurusanFilter, setJurusanFilter] = useState<string>(searchParams.get('jurusan_id') ?? 'all')

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<KelasData | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Feedback (auto-dismiss)
  const { feedback, showFeedback, setFeedback } = useFeedback()

  // Tahun ajaran options (otomatis generate)
  const tahunAjaranOptions: string[] = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: 5 }, (_, i: number) => `${currentYear + i}/${currentYear + i + 1}`)
  }, [])

  // Refresh trigger: naikkan angka untuk memuat ulang data (dipakai setelah mutasi)
  const [refreshKey, setRefreshKey] = useState(0)

  const refreshData = useCallback(() => {
    setRefreshKey((k) => k + 1)
    if (onDataChanged) onDataChanged()
  }, [onDataChanged])

  // Load data on mount, saat filter berubah, atau saat refresh diminta
  useEffect(() => {
    let cancelled = false

    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (tingkatFilter !== 'all') params.set('tingkat', tingkatFilter)
    if (jurusanFilter !== 'all') params.set('jurusan_id', jurusanFilter)
    const query = params.toString()

    fetch(`/api/admin/kelas${query ? `?${query}` : ''}`)
      .then(async (res) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => null)
          throw new Error(errorData?.error || 'Gagal memuat data')
        }
        return res.json()
      })
      .then((result) => {
        if (!cancelled) setData(Array.isArray(result) ? result : [])
      })
      .catch((err) => {
        console.error('Error fetching kelas:', err)
        if (!cancelled) setFeedback({ type: 'error', message: 'Gagal memuat data kelas' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [statusFilter, tingkatFilter, jurusanFilter, refreshKey, setFeedback])

  // Jurusan options (sekali saat mount; fetchingJurusan awal true agar spinner tampil)
  const [jurusanOptions, setJurusanOptions] = useState<JurusanData[]>([])
  const [fetchingJurusan, setFetchingJurusan] = useState(true)

  // Guru aktif untuk pilihan wali kelas
  const [guruOptions, setGuruOptions] = useState<{ id: string; nama_lengkap: string }[]>([])
  const [fetchingGuru, setFetchingGuru] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetch('/api/admin/users?role=guru&status=active')
      .then(async (res) => {
        if (!res.ok) throw new Error('Gagal memuat data guru')
        const result = await res.json()
        const rows = (Array.isArray(result) ? result : []) as { id: string; nama_lengkap: string | null; status: boolean }[]
        if (!cancelled) setGuruOptions(rows.filter((g) => g.status === true).map((g) => ({ id: g.id, nama_lengkap: g.nama_lengkap ?? g.id })))
      })
      .catch((err) => console.error('Error fetching guru:', err))
      .finally(() => {
        if (!cancelled) setFetchingGuru(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    fetch('/api/admin/jurusan?status=active')
      .then(async (res) => {
        if (!res.ok) throw new Error('Gagal memuat data jurusan')
        const result = await res.json()
        const rows = (Array.isArray(result) ? result : []) as JurusanData[]
        if (!cancelled) setJurusanOptions(rows.filter((j) => j.status === true))
      })
      .catch((err) => console.error('Error fetching jurusan:', err))
      .finally(() => {
        if (!cancelled) setFetchingJurusan(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Filter data
  const filteredData = data
    .filter((item) => {
      const jurusanMatch = searchQuery === '' || (item.jurusan && item.jurusan.nama.toLowerCase().includes(searchQuery.toLowerCase()))
      const kelasMatch =
        item.nama_kelas.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tahun_ajaran.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.tingkat.toString().includes(searchQuery)
      const matchesSearch = jurusanMatch || kelasMatch
      let matchesStatus = true
      if (statusFilter === 'active') matchesStatus = item.status === true
      if (statusFilter === 'inactive') matchesStatus = item.status === false
      let matchesTingkat = true
      if (tingkatFilter !== 'all' && tingkatFilter !== '') {
        matchesTingkat = item.tingkat.toString() === tingkatFilter
      }
      let matchesJurusan = true
      if (jurusanFilter !== 'all') {
        matchesJurusan = item.jurusan_id === jurusanFilter
      }
      return matchesSearch && matchesStatus && matchesTingkat && matchesJurusan
    })

  // Create handler
  const handleCreate = useCallback(async (formData: KelasFormData) => {
    setSubmitting(true)
    setFeedback(null)

    try {
      const res = await fetch('/api/admin/kelas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Gagal menambahkan kelas')
      }

      showFeedback('success', 'Kelas berhasil ditambahkan!')
      setIsCreateModalOpen(false)
      refreshData()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setSubmitting(false)
    }
  }, [refreshData, showFeedback, setFeedback])

  // Update handler
  const handleUpdate = useCallback(async (id: string, formData: Partial<KelasFormData> & { status?: boolean }) => {
    setSubmitting(true)
    setFeedback(null)

    try {
      const res = await fetch('/api/admin/kelas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...formData }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Gagal memperbarui kelas')
      }

      showFeedback('success', 'Kelas berhasil diperbarui!')
      setIsEditModalOpen(false)
      setEditingItem(null)
      refreshData()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setSubmitting(false)
    }
  }, [refreshData, showFeedback, setFeedback])

  // Delete handler
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus kelas ini? Tindakan ini tidak dapat dibatalkan.')) return

    setFeedback(null)

    try {
      const res = await fetch(`/api/admin/kelas?id=${id}`, {
        method: 'DELETE',
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Gagal menghapus kelas')
      }

      showFeedback('success', 'Kelas berhasil dihapus!')
      refreshData()
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Terjadi kesalahan')
    }
  }, [refreshData, showFeedback, setFeedback])

  // Generate tingkat options (10-12)
  const tingkatOptions = useMemo((): { value: string; label: string }[] => {
    return Array.from({ length: 3 }, (_, i: number) => ({
      value: (i + 10).toString(),
      label: `Kelas ${i + 10}`,
    }))
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            Data Kelas
          </h1>
          <p className="text-sm text-gray-600 mt-1.5 ml-14">
            Kelola kelas dan jurusan yang ada di sekolah.
          </p>
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)} size="lg">
          <Plus className="h-4 w-4" />
          <span>Tambah Kelas</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total</span>
            <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
              <GraduationCap className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">{data.length}</p>
          <p className="text-xs text-gray-400 mt-1">Kelas</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Aktif</span>
            <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">
            {data.filter((d) => d.status === true).length}
          </p>
          <p className="text-xs text-gray-400 mt-1">Status aktif</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tingkat</span>
            <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
              <Filter className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">
            {new Set(data.map((d) => d.tingkat)).size}
          </p>
          <p className="text-xs text-gray-400 mt-1">Jumlah tingkat</p>
        </div>
      </div>

      {/* Feedback */}
      {feedback && <FeedbackMessage type={feedback.type} message={feedback.message} />}

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama kelas atau tahun ajaran..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={jurusanFilter}
              onChange={(e) => setJurusanFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            >
              <option value="all">Semua Jurusan</option>
              {jurusanOptions.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.kode} - {j.nama}
                </option>
              ))}
            </select>

            <select
              value={tingkatFilter}
              onChange={(e) => setTingkatFilter(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            >
              <option value="all">Semua Tingkat</option>
              {tingkatOptions.map((opt: { value: string; label: string }) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <div className="flex items-center space-x-1 bg-gray-100 rounded-xl p-1">
              {(['all', 'active', 'inactive'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`
                    px-4 py-2 text-xs font-bold rounded-lg transition-all
                    ${statusFilter === status
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                    }
                  `}
                >
                  {status === 'all' ? 'Semua Status' : status === 'active' ? 'Aktif' : 'Nonaktif'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-50 mb-4 mx-auto">
              <GraduationCap className="h-8 w-8 text-purple-600 animate-spin" />
            </div>
            <p className="text-gray-500 font-medium">Memuat data...</p>
          </div>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-16 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-50 mb-4">
              <GraduationCap className="h-10 w-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Belum ada data</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Belum ada kelas yang didaftarkan. Klik &ldquo;Tambah Kelas&rdquo; untuk menambahkan.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Kelas</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Tingkat</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Jurusan</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Wali Kelas</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Siswa</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Tahun Ajaran</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm">
                          {item.nama_kelas.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{item.nama_kelas}</div>
                          <div className="text-xs text-gray-400">
                            Kelas {item.tingkat} · {item.tahun_ajaran}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold">
                        Kelas {item.tingkat}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {item.jurusan ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                          <Building2 className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                          <span className="font-medium">{item.jurusan.kode}</span>
                          <span className="text-gray-400">-</span>
                          <span>{item.jurusan.nama}</span>
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Tanpa Jurusan</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {item.wali_kelas_nama ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                          <UserCheck className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                          <span className="font-medium">{item.wali_kelas_nama}</span>
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Belum ada wali</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 text-sm text-gray-700 font-semibold">
                        <GraduationCap className="h-4 w-4 text-purple-400 flex-shrink-0" />
                        {item.jumlah_siswa ?? 0} siswa
                      </span>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {item.tahun_ajaran}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`
                          inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold
                          ${item.status
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                          }
                        `}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${item.status ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {item.status ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingItem(item)
                            setIsEditModalOpen(true)
                          }}
                          className="p-2 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Hapus"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Tambah Kelas" size="md">          <form onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            handleCreate({
              nama_kelas: formData.get('nama_kelas') as string,
              tingkat: parseInt(formData.get('tingkat') as string, 10),
              tahun_ajaran: formData.get('tahun_ajaran') as string,
              jurusan_id: formData.get('jurusan_id') as string || null,
              wali_kelas_id: formData.get('wali_kelas_id') as string || null,
            })
          }} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Nama Kelas <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              name="nama_kelas"
              placeholder="Contoh: AKL, RPL, MM"
              required
            />
            <p className="text-xs text-gray-400">Contoh: AKL (Akuntansi & Keuangan Lembaga)</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Tingkat <span className="text-red-500">*</span>
            </label>
            <select
              name="tingkat"
              required
              className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer appearance-none"
            >
              <option value="">-- Pilih tingkat --</option>
              {tingkatOptions.map((opt: { value: string; label: string }) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Tahun Ajaran <span className="text-red-500">*</span>
            </label>
            <select
              name="tahun_ajaran"
              required
              className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer appearance-none"
            >
              <option value="">-- Pilih tahun ajaran --</option>
              {tahunAjaranOptions.map((tahun: string) => (
                <option key={tahun} value={tahun}>
                  {tahun}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400">Format: 2024/2025</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Jurusan <span className="text-gray-400">(opsional)</span>
            </label>
            {fetchingJurusan ? (
              <div className="py-3 text-center text-sm text-gray-400">Memuat jurusan...</div>
            ) : jurusanOptions.length === 0 ? (
              <div className="py-3 text-center text-sm text-amber-600 bg-amber-50 rounded-xl">
                <p className="mb-1">Belum ada jurusan</p>
                <p className="text-xs opacity-80">Tambahkan jurusan terlebih dahulu</p>
              </div>
            ) : (
              <Select
                name="jurusan_id"
                options={[
                  { value: '', label: ' -- Pilih Jurusan (opsional) --' },
                  ...jurusanOptions.map((j: JurusanData) => ({
                    value: j.id,
                    label: `${j.kode} - ${j.nama}`,
                  })),
                ]}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Wali Kelas <span className="text-gray-400">(opsional)</span>
            </label>
            {fetchingGuru ? (
              <div className="py-3 text-center text-sm text-gray-400">Memuat daftar guru...</div>
            ) : guruOptions.length === 0 ? (
              <div className="py-3 text-center text-sm text-amber-600 bg-amber-50 rounded-xl">
                <p className="mb-1">Belum ada guru aktif</p>
                <p className="text-xs opacity-80">Tambahkan akun guru terlebih dahulu</p>
              </div>
            ) : (
              <Select
                name="wali_kelas_id"
                options={[
                  { value: '', label: ' -- Tanpa Wali Kelas --' },
                  ...guruOptions.map((g) => ({ value: g.id, label: g.nama_lengkap })),
                ]}
              />
            )}
            <p className="text-xs text-gray-400">Wali kelas berbeda dari guru pengampu mapel; satu guru hanya bisa wali satu kelas.</p>
          </div>

          <div className="pt-4 flex items-center space-x-3 border-t border-gray-100 mt-2">
            <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)} fullWidth size="md">
              Batal
            </Button>
            <Button type="submit" loading={submitting} disabled={submitting} fullWidth size="md">
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form >
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setEditingItem(null) }}
        title="Edit Kelas"
        size="md"
      >
        {editingItem && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              handleUpdate(editingItem.id, {
                nama_kelas: formData.get('nama_kelas') as string || undefined,
                tingkat: formData.get('tingkat') ? parseInt(formData.get('tingkat') as string, 10) : undefined,
                tahun_ajaran: formData.get('tahun_ajaran') as string || undefined,
                jurusan_id: (formData.get('jurusan_id') as string) || null,
                wali_kelas_id: (formData.get('wali_kelas_id') as string) || null,
                status: formData.get('status') === 'on' || formData.get('status') === 'true',
              })
            }}
            className="space-y-4 pt-2"
          >
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm">
                  {editingItem.nama_kelas.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{editingItem.nama_kelas}</p>
                  <p className="text-xs text-gray-500">
                    Kelas {editingItem.tingkat} · {editingItem.tahun_ajaran}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Nama Kelas
              </label>
              <Input
                type="text"
                name="nama_kelas"
                defaultValue={editingItem.nama_kelas}
                placeholder="Nama kelas"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Tingkat
              </label>
              <select
                name="tingkat"
                defaultValue={editingItem.tingkat.toString()}
                className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer appearance-none"
              >
                <option value="">-- Pilih tingkat --</option>
                {tingkatOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Tahun Ajaran
              </label>
              <select
                name="tahun_ajaran"
                defaultValue={editingItem.tahun_ajaran}
                className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer appearance-none"
              >
                <option value="">-- Pilih tahun ajaran --</option>
                {tahunAjaranOptions.map((tahun) => (
                  <option key={tahun} value={tahun}>
                    {tahun}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Jurusan <span className="text-gray-400 font-medium normal-case">(opsional)</span>
              </label>
              {fetchingJurusan ? (
                <div className="py-3 text-center text-sm text-gray-400">Memuat jurusan...</div>
              ) : jurusanOptions.length === 0 ? (
                <div className="py-3 text-center text-sm text-amber-600 bg-amber-50 rounded-xl">
                  <p className="mb-1">Belum ada jurusan</p>
                  <p className="text-xs opacity-80">Tambahkan jurusan terlebih dahulu</p>
                </div>
              ) : (
                <Select
                  name="jurusan_id"
                  defaultValue={editingItem.jurusan_id ?? ''}
                  options={[
                    { value: '', label: ' -- Tanpa Jurusan --' },
                    ...jurusanOptions.map((j: JurusanData) => ({
                      value: j.id,
                      label: `${j.kode} - ${j.nama}`,
                    })),
                  ]}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Wali Kelas <span className="text-gray-400 font-medium normal-case">(opsional)</span>
              </label>
              {fetchingGuru ? (
                <div className="py-3 text-center text-sm text-gray-400">Memuat daftar guru...</div>
              ) : guruOptions.length === 0 ? (
                <div className="py-3 text-center text-sm text-amber-600 bg-amber-50 rounded-xl">
                  <p className="mb-1">Belum ada guru aktif</p>
                  <p className="text-xs opacity-80">Tambahkan akun guru terlebih dahulu</p>
                </div>
              ) : (
                <Select
                  name="wali_kelas_id"
                  defaultValue={editingItem.wali_kelas_id ?? ''}
                  options={[
                    { value: '', label: ' -- Tanpa Wali Kelas --' },
                    ...guruOptions.map((g) => ({ value: g.id, label: g.nama_lengkap })),
                  ]}
                />
              )}
              <p className="text-xs text-gray-400">Wali kelas berbeda dari guru pengampu mapel; satu guru hanya bisa wali satu kelas.</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Status
              </label>
              <div className="flex items-center space-x-6">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="true"
                    defaultChecked={editingItem.status === true}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Aktif</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="false"
                    defaultChecked={editingItem.status === false}
                    className="h-4 w-4 text-gray-600 focus:ring-gray-500"
                  />
                  <span className="text-sm text-gray-700">Nonaktif</span>
                </label>
              </div>
            </div>

            <div className="pt-4 flex items-center space-x-3 border-t border-gray-100 mt-2">
              <Button type="button" variant="secondary" onClick={() => { setIsEditModalOpen(false); setEditingItem(null) }} fullWidth size="md">
                Batal
              </Button>
              <Button type="submit" loading={submitting} disabled={submitting} fullWidth size="md">
                {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </div>
          </form >
        )}
      </Modal>
    </div>
  )
}

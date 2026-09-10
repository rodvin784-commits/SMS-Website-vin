'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, BookOpen, Filter, Search, CheckCircle2, Users, GraduationCap } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FeedbackMessage } from '@/components/ui/FeedbackMessage'

interface GuruPengampu {
  guru_id: string
  nama_lengkap: string
  kelas: string[]
}

interface MataPelajaranData {
  id: string
  kode: string
  nama: string
  deskripsi: string | null
  status: boolean
  created_at: string
  updated_at: string | null
  guru_pengampu: GuruPengampu[]
  kelas_list: string[]
}

interface MataPelajaranManagerProps {
  onDataChanged?: () => void
}

export function MataPelajaranManager({ onDataChanged }: MataPelajaranManagerProps) {
  const [data, setData] = useState<MataPelajaranData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [detailItem, setDetailItem] = useState<MataPelajaranData | null>(null)
  const [editingItem, setEditingItem] = useState<MataPelajaranData | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Auto-dismiss feedback
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(null), 4000)
    return () => clearTimeout(timer)
  }, [feedback])

  // Refresh trigger: naikkan angka untuk memuat ulang data (dipakai setelah mutasi)
  const [refreshKey, setRefreshKey] = useState(0)
  const refreshData = useCallback(() => {
    setRefreshKey((k) => k + 1)
    if (onDataChanged) onDataChanged()
  }, [onDataChanged])

  // Load data on mount, saat refresh diminta (skeleton hanya tampil di load awal)
  useEffect(() => {
    let cancelled = false

    fetch('/api/admin/mata-pelajaran')
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
        console.error('Error fetching mata pelajaran:', err)
        if (!cancelled) setFeedback({ type: 'error', message: 'Gagal memuat data mata pelajaran' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [refreshKey])

  // Penugasan state (inside detail modal)
  type PenugasanItem = {
    id: string
    guru_id: string
    guru_nama: string
    kelas_id: string
    kelas_nama: string
    tingkat: number | null
    tahun_ajaran: string | null
    semester: string | null
    materi: string | null
  }
  type GuruOption = { id: string; nama_lengkap: string; alreadyAssigned: boolean }
  type KelasOption = { id: string; nama_kelas: string; tingkat: number }
  type SemesterOption = { value: string; label: string }

  const [penugasanAssignments, setPenugasanAssignments] = useState<PenugasanItem[]>([])
  const [penugasanGuru, setPenugasanGuru] = useState<GuruOption[]>([])
  const [penugasanKelas, setPenugasanKelas] = useState<KelasOption[]>([])
  const [penugasanSemesters, setPenugasanSemesters] = useState<SemesterOption[]>([])
  const [penugasanLoading, setPenugasanLoading] = useState(false)
  const [newGuruId, setNewGuruId] = useState('')
  const [newKelasId, setNewKelasId] = useState('')
  const [newMateri, setNewMateri] = useState('')
  const [newSemester, setNewSemester] = useState('ganjil')
  const [addingPenugasan, setAddingPenugasan] = useState(false)
  const [editingMateriId, setEditingMateriId] = useState<string | null>(null)
  const [materiDraft, setMateriDraft] = useState('')
  const [semesterDraft, setSemesterDraft] = useState('ganjil')
  const [detailFeedback, setDetailFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Fetch penugasan data for a subject
  const fetchPenugasan = useCallback(async (mapelId: string) => {
    setPenugasanLoading(true)
    try {
      const res = await fetch(`/api/admin/mata-pelajaran/${mapelId}/penugasan`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Gagal memuat penugasan')
      }
      const data = await res.json()
      const assignments: PenugasanItem[] = data.assignments ?? []
      setPenugasanAssignments(assignments)
      setPenugasanGuru(data.guru ?? [])
      setPenugasanKelas(data.kelas ?? [])
      setPenugasanSemesters(data.semesters ?? [
        { value: 'ganjil', label: 'Semester Ganjil' },
        { value: 'genap', label: 'Semester Genap' },
      ])

      // Sync detailItem's guru pengampu & kelas list so the modal stays current
      setDetailItem((prev) => {
        if (!prev) return prev
        const guruMap = new Map<string, { guru_id: string; nama_lengkap: string; kelas: string[] }>()
        for (const a of assignments) {
          let g = guruMap.get(a.guru_id)
          if (!g) {
            g = { guru_id: a.guru_id, nama_lengkap: a.guru_nama, kelas: [] }
            guruMap.set(a.guru_id, g)
          }
          if (a.kelas_nama !== '-' && !g.kelas.includes(a.kelas_nama)) {
            g.kelas.push(a.kelas_nama)
          }
        }
        const kelasSet = new Set(
          assignments.filter((a) => a.kelas_nama !== '-').map((a) => a.kelas_nama)
        )
        return {
          ...prev,
          guru_pengampu: Array.from(guruMap.values()),
          kelas_list: Array.from(kelasSet),
        }
      })
    } catch (err) {
      console.error('Error fetching penugasan:', err)
      setDetailFeedback({ type: 'error', message: 'Gagal memuat data penugasan' })
    } finally {
      setPenugasanLoading(false)
    }
  }, [])

  // Add penugasan
  const handleAddPenugasan = useCallback(async (mapelId: string) => {
    if (!newGuruId || !newKelasId) {
      setDetailFeedback({ type: 'error', message: 'Pilih guru dan kelas terlebih dahulu' })
      return
    }

    setAddingPenugasan(true)
    setDetailFeedback(null)
    try {
      const res = await fetch(`/api/admin/mata-pelajaran/${mapelId}/penugasan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guru_id: newGuruId, kelas_id: newKelasId, materi: newMateri, semester: newSemester }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal menambahkan penugasan')

      setDetailFeedback({ type: 'success', message: result.message || 'Penugasan berhasil ditambahkan' })
      setNewGuruId('')
      setNewKelasId('')
      setNewMateri('')
      await fetchPenugasan(mapelId)
      await refreshData() // refresh table data too
    } catch (err) {
      setDetailFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Terjadi kesalahan' })
    } finally {
      setAddingPenugasan(false)
    }
  }, [newGuruId, newKelasId, newMateri, newSemester, fetchPenugasan, refreshData])

  // Delete penugasan
  const handleDeletePenugasan = useCallback(async (mapelId: string, assignmentId: string) => {
    if (!confirm('Hapus penugasan ini?')) return

    setDetailFeedback(null)
    try {
      const res = await fetch(`/api/admin/mata-pelajaran/${mapelId}/penugasan?id=${assignmentId}`, {
        method: 'DELETE',
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal menghapus penugasan')

      setDetailFeedback({ type: 'success', message: 'Penugasan berhasil dihapus' })
      await fetchPenugasan(mapelId)
      await refreshData()
    } catch (err) {
      setDetailFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Terjadi kesalahan' })
    }
  }, [fetchPenugasan, refreshData])

  // Edit materi penugasan
  const startEditMateri = (assignment: PenugasanItem) => {
    setEditingMateriId(assignment.id)
    setMateriDraft(assignment.materi ?? '')
    setSemesterDraft(assignment.semester ?? 'ganjil')
  }

  const handleUpdateMateri = useCallback(async (mapelId: string) => {
    if (!editingMateriId) return

    setDetailFeedback(null)
    try {
      const res = await fetch(`/api/admin/mata-pelajaran/${mapelId}/penugasan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingMateriId, materi: materiDraft, semester: semesterDraft }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Gagal memperbarui materi')

      setDetailFeedback({ type: 'success', message: result.message || 'Pembaruan berhasil disimpan' })
      setEditingMateriId(null)
      setMateriDraft('')
      await fetchPenugasan(mapelId)
      await refreshData()
    } catch (err) {
      setDetailFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Terjadi kesalahan' })
    }
  }, [editingMateriId, materiDraft, semesterDraft, fetchPenugasan, refreshData])

  // Filter data
  const filteredData = data
    .filter((item) => {
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch =
        item.kode.toLowerCase().includes(searchLower) ||
        item.nama.toLowerCase().includes(searchLower) ||
        item.guru_pengampu.some((g) => g.nama_lengkap.toLowerCase().includes(searchLower))
      let matchesStatus = true
      if (statusFilter === 'active') matchesStatus = item.status === true
      if (statusFilter === 'inactive') matchesStatus = item.status === false
      return matchesSearch && matchesStatus
    })

  // Open detail modal — fetch fresh data to ensure guru_pengampu & kelas_list exist
  const openDetail = useCallback(async (item: MataPelajaranData) => {
    setDetailFeedback(null)
    setNewGuruId('')
    setNewKelasId('')
    setNewMateri('')
    setNewSemester('ganjil')
    setEditingMateriId(null)
    setMateriDraft('')
    setSemesterDraft('ganjil')
    try {
      const res = await fetch('/api/admin/mata-pelajaran')
      if (res.ok) {
        const all = await res.json()
        const fresh = (Array.isArray(all) ? all : []).find((m: MataPelajaranData) => m.id === item.id)
        if (fresh) {
          setDetailItem({ ...fresh, guru_pengampu: fresh.guru_pengampu ?? [], kelas_list: fresh.kelas_list ?? [] })
          setIsDetailModalOpen(true)
          fetchPenugasan(fresh.id)
          return
        }
      }
    } catch { /* fall through to use stale data */ }
    setDetailItem({ ...item, guru_pengampu: item.guru_pengampu ?? [], kelas_list: item.kelas_list ?? [] })
    setIsDetailModalOpen(true)
    fetchPenugasan(item.id)
  }, [fetchPenugasan])

  // Create handler
  const handleCreate = useCallback(async (formData: { kode: string; nama: string; deskripsi?: string }) => {
    setSubmitting(true)
    setFeedback(null)

    try {
      const res = await fetch('/api/admin/mata-pelajaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Gagal menambahkan mata pelajaran')
      }

      setFeedback({ type: 'success', message: 'Mata pelajaran berhasil ditambahkan!' })
      setIsCreateModalOpen(false)
      await refreshData()

      // Buka detail view dengan data lengkap
      setTimeout(() => {
        openDetail(result as MataPelajaranData)
      }, 300)
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Terjadi kesalahan' })
    } finally {
      setSubmitting(false)
    }
  }, [refreshData, openDetail])

  // Update handler
  const handleUpdate = useCallback(async (id: string, formData: { kode?: string; nama?: string; deskripsi?: string | null; status?: boolean }) => {
    setSubmitting(true)
    setFeedback(null)

    try {
      const res = await fetch('/api/admin/mata-pelajaran', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...formData }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Gagal memperbarui mata pelajaran')
      }

      setFeedback({ type: 'success', message: 'Mata pelajaran berhasil diperbarui!' })
      setIsEditModalOpen(false)
      setEditingItem(null)
      refreshData()
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Terjadi kesalahan' })
    } finally {
      setSubmitting(false)
    }
  }, [refreshData])

  // Nonaktifkan / Hapus handler
  const handleNonaktifkan = useCallback(async (item: MataPelajaranData) => {
    if (item.status === true) {
      // Konfirmasi nonaktifkan
      if (!confirm(`Apakah Anda yakin ingin menonaktifkan "${item.nama}"?\n\nMata pelajaran yang dinonaktifkan tidak akan muncul di pilihan penugasan guru, tetapi penugasan yang sudah ada tetap tersimpan.`)) return
    } else {
      // Konfirmasi hapus permanen
      if (!confirm(`Hapus permanen "${item.nama}"?\n\nTindakan ini tidak dapat dibatalkan.`)) return
    }

    setFeedback(null)

    try {
      const res = await fetch(`/api/admin/mata-pelajaran?id=${item.id}`, {
        method: 'DELETE',
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Gagal memproses mata pelajaran')
      }

      setFeedback({ type: 'success', message: result.message || 'Berhasil diproses' })
      refreshData()
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Terjadi kesalahan' })
    }
  }, [refreshData])

  // Format tanggal
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            Data Mata Pelajaran
          </h1>
          <p className="text-sm text-gray-600 mt-1.5 ml-14">
            Kelola mata pelajaran yang diajarkan di sekolah.
          </p>
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)} size="lg">
          <Plus className="h-4 w-4" />
          <span>Tambah Mata Pelajaran</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
              <BookOpen className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">{data.length}</p>
          <p className="text-xs text-gray-400 mt-1">Mata pelajaran</p>
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
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nonaktif</span>
            <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
              <Filter className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-gray-900">
            {data.filter((d) => d.status === false).length}
          </p>
          <p className="text-xs text-gray-400 mt-1">Status nonaktif</p>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <FeedbackMessage type={feedback.type} message={feedback.message} />
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari kode, nama, atau guru..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

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
                {status === 'all' ? 'Semua' : status === 'active' ? 'Aktif' : 'Nonaktif'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Data Table */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-4 mx-auto">
              <BookOpen className="h-8 w-8 text-emerald-600 animate-spin" />
            </div>
            <p className="text-gray-500 font-medium">Memuat data...</p>
          </div>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-16 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-50 mb-4">
              <BookOpen className="h-10 w-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Belum ada data</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              {searchQuery || statusFilter !== 'all'
                ? 'Tidak ada mata pelajaran yang cocok dengan filter.'
                : 'Belum ada mata pelajaran yang didaftarkan. Klik "Tambah Mata Pelajaran" untuk menambahkan.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Kode</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Nama</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Guru Pengampu</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredData.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                    onClick={() => openDetail(item)}
                  >
                    <td className="py-4 px-6">
                      <span className="font-bold text-emerald-600 text-sm whitespace-nowrap">{item.kode}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div>
                        <span className="font-semibold text-gray-900">{item.nama}</span>
                        {item.deskripsi && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 max-w-[250px]">{item.deskripsi}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm">
                      {item.guru_pengampu.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.guru_pengampu.slice(0, 2).map((g) => (
                            <span key={g.guru_id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                              {g.nama_lengkap}
                            </span>
                          ))}
                          {item.guru_pengampu.length > 2 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                              +{item.guru_pengampu.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs italic">Belum ditugaskan</span>
                      )}
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
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openDetail(item)}
                          className="p-2 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Lihat Detail"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => {
                            setEditingItem(item)
                            setIsEditModalOpen(true)
                          }}
                          className="p-2 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleNonaktifkan(item)}
                          className={`p-2 rounded-lg transition-all ${
                            item.status
                              ? 'text-amber-400 hover:text-amber-600 hover:bg-amber-50'
                              : 'text-red-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title={item.status ? 'Nonaktifkan' : 'Hapus Permanen'}
                        >
                          {item.status ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
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

      {/* ===== DETAIL MODAL ===== */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => { setIsDetailModalOpen(false); setDetailItem(null) }}
        title="Detail Mata Pelajaran"
        size="lg"
      >
        {detailItem && (
          <div className="space-y-6 pt-2">
            {/* Header Info */}
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-black text-xl shadow-lg flex-shrink-0">
                {detailItem.kode}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-extrabold text-gray-900">{detailItem.nama}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-gray-500">Kode: <strong>{detailItem.kode}</strong></span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                    detailItem.status ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${detailItem.status ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    {detailItem.status ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              </div>
            </div>

            {/* Deskripsi */}
            {detailItem.deskripsi && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Deskripsi</p>
                <p className="text-sm text-gray-700 leading-relaxed">{detailItem.deskripsi}</p>
              </div>
            )}

            {/* Detail Feedback */}
            {detailFeedback && (
              <FeedbackMessage type={detailFeedback.type} message={detailFeedback.message} />
            )}

            {/* Guru Pengampu — Interactive */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Guru Pengampu ({penugasanAssignments.length})
              </p>

              {penugasanLoading ? (
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent mx-auto mb-2" />
                  <p className="text-xs text-gray-400">Memuat data penugasan...</p>
                </div>
              ) : penugasanAssignments.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Belum ada guru yang ditugaskan</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {penugasanAssignments.map((a) => (
                    <div key={a.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">
                        {a.guru_nama.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{a.guru_nama}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                            {a.kelas_nama}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                            Semester {a.semester === 'genap' ? 'Genap' : 'Ganjil'}
                            {a.tahun_ajaran ? ` · ${a.tahun_ajaran}` : ''}
                          </span>
                          {editingMateriId === a.id ? (
                            <span className="flex items-center gap-1.5 flex-wrap">
                              <input
                                type="text"
                                value={materiDraft}
                                onChange={(e) => setMateriDraft(e.target.value)}
                                placeholder="Materi / bahan ajar"
                                autoFocus
                                className="px-2.5 py-1 text-xs bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              />
                              <select
                                value={semesterDraft}
                                onChange={(e) => setSemesterDraft(e.target.value)}
                                className="px-2 py-1 text-xs bg-white border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                              >
                                {penugasanSemesters.length > 0
                                  ? penugasanSemesters.map((s) => (
                                      <option key={s.value} value={s.value}>{s.label}</option>
                                    ))
                                  : (
                                    <>
                                      <option value="ganjil">Semester Ganjil</option>
                                      <option value="genap">Semester Genap</option>
                                    </>
                                  )}
                              </select>
                              <button
                                onClick={() => handleUpdateMateri(detailItem.id)}
                                className="px-2 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all"
                              >
                                Simpan
                              </button>
                              <button
                                onClick={() => setEditingMateriId(null)}
                                className="px-2 py-1 text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-all"
                              >
                                Batal
                              </button>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              {a.materi ? (
                                <span className="text-xs text-gray-600 italic">Materi: {a.materi}</span>
                              ) : (
                                <span className="text-xs text-gray-300 italic">Belum ada materi</span>
                              )}
                              <button
                                onClick={() => startEditMateri(a)}
                                className="p-0.5 text-gray-400 hover:text-blue-600 rounded transition-all"
                                title="Edit Materi / Semester"
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeletePenugasan(detailItem.id, a.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                        title="Hapus Penugasan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Form Tambah Penugasan */}
              {detailItem.status && (
                <div className="mt-4 bg-blue-50/60 border border-blue-100 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">Tambah Penugasan</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={newGuruId}
                      onChange={(e) => setNewGuruId(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-white border border-blue-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">-- Pilih Guru --</option>
                      {penugasanGuru.map((g) => {
                        // Disable hanya jika guru sudah ditugaskan di mapel ini UNTUK kelas yang sedang dipilih
                        const guruKelasTaken = newKelasId
                          ? penugasanAssignments.some(
                              (a) => a.guru_id === g.id && a.kelas_id === newKelasId
                            )
                          : false
                        return (
                          <option key={g.id} value={g.id} disabled={guruKelasTaken}>
                            {g.nama_lengkap}{' '}
                            {guruKelasTaken ? '(sudah di kelas ini)' : g.alreadyAssigned ? '(sudah ada di mapel ini)' : ''}
                          </option>
                        )
                      })}
                    </select>
                    <select
                      value={newKelasId}
                      onChange={(e) => setNewKelasId(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-white border border-blue-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">-- Pilih Kelas --</option>
                      {penugasanKelas.map((k) => (
                        <option key={k.id} value={k.id}>
                          Kelas {k.tingkat} — {k.nama_kelas}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="text"
                    value={newMateri}
                    onChange={(e) => setNewMateri(e.target.value)}
                    placeholder="Materi / bahan ajar (opsional — contoh: Bab 1 Bilangan)"
                    className="mt-3 w-full px-4 py-2.5 bg-white border border-blue-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <div className="mt-3 flex flex-col sm:flex-row gap-3">
                    <select
                      value={newSemester}
                      onChange={(e) => setNewSemester(e.target.value)}
                      className="flex-1 px-4 py-2.5 bg-white border border-blue-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      {penugasanSemesters.length > 0
                        ? penugasanSemesters.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))
                        : (
                          <>
                            <option value="ganjil">Semester Ganjil</option>
                            <option value="genap">Semester Genap</option>
                          </>
                        )}
                    </select>
                    <Button
                      onClick={() => handleAddPenugasan(detailItem.id)}
                      loading={addingPenugasan}
                      disabled={addingPenugasan || !newGuruId || !newKelasId}
                      size="md"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Simpan</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Daftar Kelas */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Kelas ({detailItem.kelas_list.length})
              </p>
              {detailItem.kelas_list.length === 0 ? (
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <GraduationCap className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Belum ada kelas yang terkait</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {detailItem.kelas_list.map((k) => (
                    <span key={k} className="inline-flex items-center px-3 py-1.5 rounded-xl text-sm font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Info Tambahan */}
            <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1">
              <p>Dibuat: {formatDate(detailItem.created_at)}</p>
              {detailItem.updated_at && (
                <p>Diperbarui: {formatDate(detailItem.updated_at)}</p>
              )}
            </div>

            {/* Actions */}
            <div className="pt-4 flex items-center space-x-3 border-t border-gray-100">
              <Button variant="secondary" onClick={() => { setIsDetailModalOpen(false); setDetailItem(null) }} fullWidth size="md">
                Tutup
              </Button>
              <Button onClick={() => {
                setIsDetailModalOpen(false)
                setEditingItem(detailItem)
                setIsEditModalOpen(true)
              }} fullWidth size="md">
                <Pencil className="h-4 w-4" />
                Edit Mata Pelajaran
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== CREATE MODAL ===== */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Tambah Mata Pelajaran" size="md">
        <form onSubmit={(e) => {
          e.preventDefault()
          const formData = new FormData(e.currentTarget)
          handleCreate({
            kode: formData.get('kode') as string,
            nama: formData.get('nama') as string,
            deskripsi: formData.get('deskripsi') as string || undefined,
          })
        }} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Kode <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              name="kode"
              placeholder="Contoh: MTK, ING, BIO"
              required
              maxLength={20}
            />
            <p className="text-xs text-gray-400">Kode unik untuk mata pelajaran (maks. 20 karakter)</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Nama <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              name="nama"
              placeholder="Contoh: Matematika, Bahasa Inggris"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Deskripsi
            </label>
            <textarea
              name="deskripsi"
              rows={3}
              placeholder="Deskripsi singkat tentang mata pelajaran ini (opsional)"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
            <strong>Langkah selanjutnya:</strong> Setelah menyimpan, Anda bisa langsung mengatur guru pengampu dan kelas.
          </div>

          <div className="pt-4 flex items-center space-x-3 border-t border-gray-100 mt-2">
            <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)} fullWidth size="md">
              Batal
            </Button>
            <Button type="submit" loading={submitting} disabled={submitting} fullWidth size="md">
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ===== EDIT MODAL ===== */}
      <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setEditingItem(null) }} title="Edit Mata Pelajaran" size="md">
        {editingItem && (
          <form onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            handleUpdate(editingItem.id, {
              kode: formData.get('kode') as string || undefined,
              nama: formData.get('nama') as string || undefined,
              deskripsi: (formData.get('deskripsi') as string) || null,
              status: formData.get('status') === 'true',
            })
          }} className="space-y-4 pt-2">
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                  {editingItem.kode.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{editingItem.kode}</p>
                  <p className="text-xs text-gray-500">{editingItem.nama}</p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Kode
              </label>
              <Input
                type="text"
                name="kode"
                defaultValue={editingItem.kode}
                placeholder="Contoh: MTK"
                maxLength={20}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Nama
              </label>
              <Input
                type="text"
                name="nama"
                defaultValue={editingItem.nama}
                placeholder="Nama mata pelajaran"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Deskripsi
              </label>
              <textarea
                name="deskripsi"
                rows={3}
                defaultValue={editingItem.deskripsi ?? ''}
                placeholder="Deskripsi singkat tentang mata pelajaran ini (opsional)"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Status
              </label>
              <div className="flex items-center space-x-3">
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
          </form>
        )}
      </Modal>
    </div>
  )
}

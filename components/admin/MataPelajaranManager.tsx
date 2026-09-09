'use client'

import { useState, useCallback, useEffect } from 'react'
import { Plus, Pencil, Trash2, BookOpen, Filter, Search, X, CheckCircle2, AlertCircle, Edit2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FeedbackMessage } from '@/components/ui/FeedbackMessage'
import type { MapelOption } from './MengajarModal'

interface MataPelajaranData {
  id: string
  kode: string
  nama: string
  status: boolean
  created_at: string
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
  const [editingItem, setEditingItem] = useState<MataPelajaranData | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/mata-pelajaran')
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Gagal memuat data')
      }
      const result = await res.json()
      setData(Array.isArray(result) ? result : [])
    } catch (err) {
      console.error('Error fetching mata pelajaran:', err)
      setFeedback({ type: 'error', message: 'Gagal memuat data mata pelajaran' })
    } finally {
      setLoading(false)
    }
  }, [])

  // Load data on mount
  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  // Refresh data
  const refreshData = useCallback(async () => {
    setLoading(true)
    await fetchData()
    if (onDataChanged) onDataChanged()
  }, [fetchData, onDataChanged])

  // Filter data
  const filteredData = data
    .filter((item) => {
      const matchesSearch =
        item.kode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.nama.toLowerCase().includes(searchQuery.toLowerCase())
      let matchesStatus = true
      if (statusFilter === 'active') matchesStatus = item.status === true
      if (statusFilter === 'inactive') matchesStatus = item.status === false
      return matchesSearch && matchesStatus
    })
    .map((item) => ({
      ...item,
      kode: item.kode,
      nama: item.nama,
    }))

  // Create handler
  const handleCreate = useCallback(async (formData: { kode: string; nama: string }) => {
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
      refreshData()
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Terjadi kesalahan' })
    } finally {
      setSubmitting(false)
    }
  }, [refreshData])

  // Update handler
  const handleUpdate = useCallback(async (id: string, formData: { kode?: string; nama?: string; status?: boolean }) => {
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

  // Delete handler
  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus mata pelajaran ini? Tindakan ini tidak dapat dibatalkan.')) return

    setFeedback(null)

    try {
      const res = await fetch(`/api/admin/mata-pelajaran?id=${id}`, {
        method: 'DELETE',
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || 'Gagal menghapus mata pelajaran')
      }

      setFeedback({ type: 'success', message: 'Mata pelajaran berhasil dihapus!' })
      refreshData()
    } catch (err) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Terjadi kesalahan' })
    }
  }, [refreshData])

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
              placeholder="Cari kode atau nama..."
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
              Belum ada mata pelajaran yang didaftarkan. Klik "Tambah Mata Pelajaran" untuk menambahkan.
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
                  <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="py-4 px-6 text-xs font-bold text-gray-700 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group">
                    <td className="py-4 px-6 font-bold text-emerald-600 text-sm">{item.kode}</td>
                    <td className="py-4 px-6 font-semibold text-gray-900">{item.nama}</td>
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
                          className="p-2 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
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
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Tambah Mata Pelajaran" size="md">
        <form onSubmit={(e) => {
          e.preventDefault()
          const formData = new FormData(e.currentTarget)
          handleCreate({
            kode: formData.get('kode') as string,
            nama: formData.get('nama') as string,
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
              maxLength={10}
            />
            <p className="text-xs text-gray-400">Masukkan kode singkat (max 10 karakter)</p>
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

      {/* Edit Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setEditingItem(null) }} title="Edit Mata Pelajaran" size="md">
        {editingItem && (
          <form onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            handleUpdate(editingItem.id, {
              kode: formData.get('kode') as string || undefined,
              nama: formData.get('nama') as string || undefined,
              status: formData.get('status') === 'on' || formData.get('status') === 'true',
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

'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Calendar, Plus, Pencil, Trash2, Clock, DoorOpen, BookOpen } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'
import { FeedbackMessage } from '@/components/ui/FeedbackMessage'
import { useFeedback } from '@/hooks/useFeedback'

interface KelasOption {
  id: string
  nama_kelas: string
  tingkat: number
}

interface PenugasanOption {
  guru_kelas_id: string
  label: string
  tahun_ajaran: string | null
  kelas_id: string | null
  mapel_nama: string | null
  guru_nama: string | null
}

interface JadwalItem {
  id: string
  hari: string
  jam_mulai: string
  jam_selesai: string
  ruangan: string | null
  tahun_ajaran: string | null
  guru_id: string
  mata_pelajaran_id: string
  kelas_id: string
  mapel_nama: string | null
  mapel_kode: string | null
  guru_nama: string | null
}

const HARI_ORDER = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export function JadwalManager() {
  const [kelasOptions, setKelasOptions] = useState<KelasOption[]>([])
  const [penugasanOptions, setPenugasanOptions] = useState<PenugasanOption[]>([])
  const [selectedKelasId, setSelectedKelasId] = useState('')
  const [jadwal, setJadwal] = useState<JadwalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingJadwal, setLoadingJadwal] = useState(false)

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    guru_kelas_id: '',
    hari: '',
    jam_mulai: '',
    jam_selesai: '',
    ruangan: '',
  })

  const { feedback, showFeedback, setFeedback } = useFeedback()

  const fetchOptions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/jadwal')
      const data = (await res.json()) as { kelas: KelasOption[]; penugasan: PenugasanOption[] }
      setKelasOptions(Array.isArray(data.kelas) ? data.kelas : [])
      setPenugasanOptions(Array.isArray(data.penugasan) ? data.penugasan : [])
    } catch (err) {
      console.error('Error fetching jadwal options:', err)
      showFeedback('error', 'Gagal memuat opsi jadwal')
    } finally {
      setLoading(false)
    }
  }, [showFeedback])

  const fetchJadwal = useCallback(
    async (kelasId: string) => {
      if (!kelasId) {
        setJadwal([])
        return
      }
      setLoadingJadwal(true)
      try {
        const res = await fetch(`/api/admin/jadwal?kelas_id=${encodeURIComponent(kelasId)}`)
        if (!res.ok) {
          throw new Error('Gagal memuat jadwal')
        }
        const data = (await res.json()) as { jadwal: JadwalItem[] }
        setJadwal(Array.isArray(data.jadwal) ? data.jadwal : [])
      } catch (err) {
        console.error('Error fetching jadwal:', err)
        showFeedback('error', 'Gagal memuat jadwal kelas')
      } finally {
        setLoadingJadwal(false)
      }
    },
    [showFeedback]
  )

  useEffect(() => {
    async function init() {
      await fetchOptions()
    }

    void init()
  }, [fetchOptions])

  const handleSelectKelas = (kelasId: string) => {
    setSelectedKelasId(kelasId)
    fetchJadwal(kelasId)
  }

  const penugasanKelas = useMemo(() => {
    return penugasanOptions.filter((p) => p.kelas_id === selectedKelasId)
  }, [penugasanOptions, selectedKelasId])

  const resetForm = () => {
    setForm({ guru_kelas_id: '', hari: '', jam_mulai: '', jam_selesai: '', ruangan: '' })
  }

  const openModal = () => {
    if (penugasanKelas.length === 0) {
      showFeedback('error', 'Kelas ini belum punya penugasan guru. Tambahkan penugasan dulu di halaman Mata Pelajaran.')
      return
    }
    setEditingId(null)
    resetForm()
    setFeedback(null)
    setIsModalOpen(true)
  }

  const openEditModal = (item: JadwalItem) => {
    setEditingId(item.id)
    setForm({
      guru_kelas_id: '',
      hari: item.hari,
      jam_mulai: item.jam_mulai,
      jam_selesai: item.jam_selesai,
      ruangan: item.ruangan ?? '',
    })
    setFeedback(null)
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!form.hari || !form.jam_mulai || !form.jam_selesai) {
      showFeedback('error', 'Lengkapi hari dan jam mulai-selesai')
      return
    }
    if (!editingId && !form.guru_kelas_id) {
      showFeedback('error', 'Pilih penugasan guru')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/jadwal', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          guru_kelas_id: form.guru_kelas_id || undefined,
          hari: form.hari,
          jam_mulai: form.jam_mulai,
          jam_selesai: form.jam_selesai,
          ruangan: form.ruangan?.trim() || null,
        }),
      })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Gagal menyimpan jadwal')
      }

      setIsModalOpen(false)
      setEditingId(null)
      resetForm()
      showFeedback('success', data?.message || 'Jadwal berhasil disimpan')
      fetchJadwal(selectedKelasId)
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Gagal menyimpan jadwal')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus jadwal ini? Tindakan ini tidak dapat dibatalkan.')) return

    try {
      const res = await fetch(`/api/admin/jadwal?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error(data?.error || 'Gagal menghapus jadwal')
      }

      showFeedback('success', data?.message || 'Jadwal berhasil dihapus')
      fetchJadwal(selectedKelasId)
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Gagal menghapus jadwal')
    }
  }

  const selectedKelas = kelasOptions.find((k) => k.id === selectedKelasId)

  const jadwalPerHari = useMemo(() => {
    const map = new Map<string, JadwalItem[]>()
    HARI_ORDER.forEach((h) => map.set(h, []))
    jadwal.forEach((item) => {
      map.get(item.hari)?.push(item)
    })
    map.forEach((list) => {
      list.sort((a, b) => (a.jam_mulai < b.jam_mulai ? -1 : 1))
    })
    return map
  }, [jadwal])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            Jadwal Pelajaran
          </h1>
          <p className="text-sm text-gray-600">Atur jadwal mengajar per kelas untuk setiap hari.</p>
        </div>
        <Button type="button" onClick={openModal} disabled={!selectedKelasId}>
          <Plus className="h-4 w-4" />
          <span>Tambah Jadwal</span>
        </Button>
      </div>

      {feedback && <FeedbackMessage type={feedback.type} message={feedback.message} />}

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
          Pilih Kelas
        </label>
        {loading ? (
          <p className="text-sm text-gray-400">Memuat opsi kelas...</p>
        ) : (
          <Select
            value={selectedKelasId}
            onChange={(e) => handleSelectKelas(e.target.value)}
            placeholder=" -- Pilih Kelas -- "
            options={kelasOptions.map((k) => ({
              value: k.id,
              label: `Kelas ${k.tingkat} ${k.nama_kelas}`,
            }))}
          />
        )}
        {selectedKelas && (
          <p className="text-xs text-gray-500 mt-2">
            Menampilkan jadwal <span className="font-semibold text-gray-700">Kelas {selectedKelas.tingkat} {selectedKelas.nama_kelas}</span>{' '}
            — {jadwal.length} pertemuan · {penugasanKelas.length} penugasan guru tersedia
          </p>
        )}
      </div>

      {!selectedKelasId ? (
        <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-200 text-center">
          <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Pilih kelas terlebih dahulu untuk melihat atau mengatur jadwalnya.</p>
        </div>
      ) : loadingJadwal ? (
        <div className="text-center text-sm text-gray-400 py-8">Memuat jadwal...</div>
      ) : jadwal.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-200 text-center">
          <Clock className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            Belum ada jadwal untuk kelas ini. Klik{' '}
            <span className="font-semibold text-indigo-600">Tambah Jadwal</span> untuk membuat jadwal pertama.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {HARI_ORDER.map((hari) => {
            const items = jadwalPerHari.get(hari) ?? []
            return (
              <div key={hari} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900">{hari}</h3>
                  <span className="text-xs font-semibold text-gray-400">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.length === 0 ? (
                    <p className="text-xs text-gray-300 text-center py-4">Kosong</p>
                  ) : (
                    items.map((item) => (
                      <div
                        key={item.id}
                        className="group rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 transition-colors hover:border-indigo-200"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                              <Clock className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">
                                {item.jam_mulai}-{item.jam_selesai}
                              </span>
                            </p>
                            <p className="text-sm font-bold text-gray-900 mt-1 flex items-center gap-1">
                              <BookOpen className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                              <span className="truncate">{item.mapel_nama ?? '-'}</span>
                            </p>
                            <p className="text-xs text-gray-600 truncate">{item.guru_nama ?? 'Tanpa Guru'}</p>
                            {item.ruangan && (
                              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                <DoorOpen className="h-3 w-3 flex-shrink-0" />
                                {item.ruangan}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => openEditModal(item)}
                              title="Edit jadwal"
                              className="text-gray-300 hover:text-indigo-500 transition-colors p-1"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              title="Hapus jadwal"
                              className="text-gray-300 hover:text-red-500 transition-colors p-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Tambah Jadwal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`${editingId ? 'Edit' : 'Tambah'} Jadwal${selectedKelas ? ` — Kelas ${selectedKelas.tingkat} ${selectedKelas.nama_kelas}` : ''}`}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Penugasan Guru
            </label>
            <Select
              value={form.guru_kelas_id}
              onChange={(e) => setForm((prev) => ({ ...prev, guru_kelas_id: e.target.value }))}
              placeholder={editingId ? ' -- Pertahankan penugasan saat ini -- ' : ' -- Pilih Penugasan (Mapel — Guru) -- '}
              options={penugasanKelas.map((p) => ({ value: p.guru_kelas_id, label: p.label }))}
            />
            {form.guru_kelas_id && (
              <p className="text-xs text-gray-500 mt-1.5">
                Tahun Ajaran {penugasanKelas.find((p) => p.guru_kelas_id === form.guru_kelas_id)?.tahun_ajaran ?? '-'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">Hari</label>
            <Select
              value={form.hari}
              onChange={(e) => setForm((prev) => ({ ...prev, hari: e.target.value }))}
              placeholder=" -- Pilih Hari -- "
              options={HARI_ORDER.map((h) => ({ value: h, label: h }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Jam Mulai"
              type="time"
              value={form.jam_mulai}
              onChange={(e) => setForm((prev) => ({ ...prev, jam_mulai: e.target.value }))}
            />
            <Input
              label="Jam Selesai"
              type="time"
              value={form.jam_selesai}
              onChange={(e) => setForm((prev) => ({ ...prev, jam_selesai: e.target.value }))}
            />
          </div>

          <Input
            label="Ruangan (opsional)"
            placeholder="Contoh: Lab Fisika, A-12"
            value={form.ruangan}
            onChange={(e) => setForm((prev) => ({ ...prev, ruangan: e.target.value }))}
          />

          <div className="pt-4 flex items-center space-x-3 border-t border-gray-100 mt-2">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} fullWidth size="md">
              Batal
            </Button>
            <Button type="submit" loading={submitting} disabled={submitting} fullWidth size="md">
              {submitting ? 'Menyimpan...' : 'Simpan Jadwal'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
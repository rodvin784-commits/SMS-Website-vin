'use client'

import { useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { CheckCircle2, AlertCircle, BookOpen, Users, GraduationCap } from 'lucide-react'
import type { Profile } from '@/components/admin/UserTable'

export type MapelOption = { id: string; kode: string; nama: string }
export type KelasOption = { id: string; nama_kelas: string; tingkat: number; tahun_ajaran: string }
export type GuruAssignment = { id: string; mapel_id: string; mapel_nama: string | null; mapel_kode: string | null; kelas_id: string; kelas_nama: string | null; materi: string | null }

interface MengajarOptions {
  mapel: MapelOption[]
  kelas: KelasOption[]
  assignments: GuruAssignment[]
}

interface MengajarModalProps {
  isOpen: boolean
  user: Profile | null
  onClose: () => void
  onSave: (data: {
    guru_id: string  // ← Gunakan 'guru_id' (dengan underscore) sesuai API
    assignments: { mapel_id: string; kelas_id: string; materi: string | null }[]
  }) => Promise<void>
  options: MengajarOptions
  loading?: boolean
  saving?: boolean
  error?: string | null
  success?: string | null
}

export function MengajarModal({
  isOpen,
  user,
  onClose,
  onSave,
  options,
  loading = false,
  saving = false,
  error,
  success,
}: MengajarModalProps) {
  const [selectedMapelId, setSelectedMapelId] = useState('')
  const [kelasSelections, setKelasSelections] = useState<Record<string, { checked: boolean; materi: string }>>({})

  const setKelasChecked = (kelasId: string, checked: boolean) => {
    setKelasSelections((prev) => ({
      ...prev,
      [kelasId]: { checked, materi: prev[kelasId]?.materi ?? '' },
    }))
  }

  const setKelasMateri = (kelasId: string, materi: string) => {
    setKelasSelections((prev) => ({
      ...prev,
      [kelasId]: { checked: prev[kelasId]?.checked ?? false, materi },
    }))
  }

  const validate = (): string | null => {
    if (!selectedMapelId) return 'Pilih mata pelajaran yang diampu guru ini.'
    const checkedKelas = options.kelas.filter((k) => kelasSelections[k.id]?.checked)
    if (checkedKelas.length === 0) return 'Centang minimal satu kelas yang diajarkan.'
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    // CRITICAL: Validasi sebelum submit
    // ID Guru diambil dari props `user` yang sudah dipassing dari halaman admin
    // Form tidak perlu input ID Guru karena otomatis terisi dari user yang dipilih
    if (!user) {
      // Ini seharusnya tidak terjadi karena component mengecek user di awal
      console.error('MengajarModal: user tidak tersedia')
      return
    }

    const validationError = validate()
    if (validationError) {
      return
    }

    const checkedKelas = options.kelas.filter((k) => kelasSelections[k.id]?.checked)
    
    // Auto-populate: ID Guru otomatis dari user yang sedang diproses
    // PERHATIAN: Gunakan kunci 'guru_id' (bukan 'guruId') agar cocok dengan API route
    // Format yang diharapkan API: { guru_id, assignments: [...] }
    const payload = {
      guru_id: user.id, // ← Gunakan 'guru_id' (dengan underscore) sesuai API
      assignments: checkedKelas.map((k) => ({
        mapel_id: selectedMapelId,
        kelas_id: k.id,
        materi: kelasSelections[k.id]?.materi || null,
      })),
    }

    console.log('MengajarModal - Mengirim payload:', JSON.stringify(payload, null, 2))
    await onSave(payload)
  }

  if (!user) return null

  const selectedMapel = options.mapel.find((m) => m.id === selectedMapelId)
  const checkedKelasCount = Object.values(kelasSelections).filter((s) => s.checked).length

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Atur Mapel & Kelas"
      size="2xl"
      showCloseButton={false}
    >
      {/* Header Info */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
        <div>
          <h3 className="font-extrabold text-lg text-gray-900 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-emerald-600" />
            Atur Mapel & Kelas
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {user.nama_lengkap || 'Guru'} — pilih mapel yang diampu & kelas yang diajarkan
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Feedback Messages */}
      {error && (
        <div className="mb-4 p-3 rounded-xl text-sm font-medium flex items-center gap-2 bg-red-50 text-red-700 border border-red-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 rounded-xl text-sm font-medium flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4">
            <BookOpen className="h-6 w-6 text-blue-600 animate-spin" />
          </div>
          <p className="text-gray-500 font-medium">Memuat data...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Mapel Selection */}
          <div className="bg-gray-50 rounded-xl p-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-emerald-600" />
              Mata Pelajaran yang Diampu
            </label>
            {options.mapel.length === 0 ? (
              <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="font-medium mb-1 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Belum ada mata pelajaran
                </p>
                <p className="text-xs opacity-80">Tambahkan dulu data di tabel <code>mata_pelajaran</code> (Supabase). Pastikan status = true.</p>
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedMapelId}
                  onChange={(e) => setSelectedMapelId(e.target.value)}
                  className="w-full px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer appearance-none"
                >
                  <option value="">-- Pilih mata pelajaran --</option>
                  {options.mapel.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.kode} — {m.nama}
                    </option>
                  ))}
                </select>
                <svg
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            )}
            {selectedMapel && (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-600 bg-white rounded-lg px-3 py-2 border border-gray-100">
                <BookOpen className="h-4 w-4 text-emerald-600" />
                <span>
                  Memilih: <strong className="text-gray-900">{selectedMapel.kode} — {selectedMapel.nama}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Kelas Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-3 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-blue-600" />
              Kelas yang Diajarkan
              <span className="text-gray-400 font-normal">(centang kelas & tambahkan materi opsional)</span>
            </label>
            {options.kelas.length === 0 ? (
              <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="font-medium mb-1 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Belum ada kelas
                </p>
                <p className="text-xs opacity-80">Tambahkan dulu data di tabel <code>kelas</code> (Supabase). Pastikan status = true.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {options.kelas.map((k) => {
                  const sel = kelasSelections[k.id] || { checked: false, materi: '' }
                  const isAssigned = options.assignments.some((a) => a.kelas_id === k.id)

                  return (
                    <div
                      key={k.id}
                      className={`
                        rounded-xl border p-4 transition-all
                        ${sel.checked
                          ? 'border-emerald-300 bg-emerald-50/50'
                          : isAssigned
                            ? 'border-amber-300 bg-amber-50/30'
                            : 'border-gray-200 bg-gray-50'
                        }
                      `}
                    >
                      {/* Checkbox + Info */}
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sel.checked}
                          onChange={(e) => setKelasChecked(k.id, e.target.checked)}
                          className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                          disabled={isAssigned && !sel.checked}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900 text-base">{k.nama_kelas}</span>
                            {isAssigned && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Sudah ada</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 ml-7">
                            Kelas {k.tingkat} · {k.tahun_ajaran}
                          </span>
                        </div>
                      </label>

                      {/* Materi Input */}
                      {sel.checked && (
                        <div className="mt-3 ml-9">
                          <input
                            type="text"
                            value={sel.materi}
                            onChange={(e) => setKelasMateri(k.id, e.target.value)}
                            placeholder="Materi khusus kelas ini (mis. Aljabar, Trigonometri, dll)"
                            className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          />
                          {sel.materi && (
                            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Materi: {sel.materi}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Summary */}
          {selectedMapelId && checkedKelasCount > 0 && (
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
              <p className="text-sm font-medium text-emerald-700 flex items-center gap-2 mb-2">
                <Users className="h-4 w-4" />
                Ringkasan Penugasan:
              </p>
              <ul className="text-xs text-emerald-600 space-y-1 pl-5 list-disc">
                <li>
                  <strong>Mapel:</strong> {selectedMapel?.kode} — {selectedMapel?.nama}
                </li>
                <li>
                  <strong>Kelas terpilih:</strong> {checkedKelasCount} kelas
                </li>
                {Object.entries(kelasSelections)
                  .filter(([, s]) => s.checked && s.materi)
                  .map(([kId, s]) => {
                    const kelas = options.kelas.find((k) => k.id === kId)
                    return (
                      <li key={kId}>
                        <strong>{kelas?.nama_kelas}:</strong> {s.materi}
                      </li>
                    )
                  })}
              </ul>
            </div>
          )}

          {/* Buttons */}
          <div className="pt-4 flex items-center space-x-3 border-t border-gray-100 mt-2">
            <Button type="button" variant="secondary" onClick={onClose} fullWidth size="md">
              Batal
            </Button>
            <Button type="submit" loading={saving} disabled={saving} fullWidth size="md">
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.5 0 0 5.5 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.134 5.824 3 7.937l3-2.647z" />
                  </svg>
                  Menyimpan...
                </span>
              ) : (
                'Simpan Penugasan'
              )}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { Pencil, GraduationCap } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { FeedbackMessage } from '@/components/ui/FeedbackMessage'
import { useKelasOptions } from '@/hooks/useKelasOptions'
import { validateUserEdit } from '@/lib/user-validation'
import type { Profile } from '@/components/admin/UserTable'

interface EditUserFormData {
  nama_lengkap: string
  email: string
  role: 'guru' | 'siswa'
  status: boolean
  password?: string
  kelas_id: string
  nip: string
  nis: string
}

interface EditUserModalProps {
  isOpen: boolean
  user: Profile | null
  onClose: () => void
  onSubmit: (data: EditUserFormData & { id: string }) => Promise<void>
  submitting?: boolean
}

export function EditUserModal({
  isOpen,
  user,
  onClose,
  onSubmit,
  submitting = false,
}: EditUserModalProps) {
  const [localError, setLocalError] = useState<string | null>(null)
  const [formData, setFormData] = useState<EditUserFormData>({
    nama_lengkap: '',
    email: '',
    role: 'guru',
    status: true,
    kelas_id: '',
    nip: '',
    nis: '',
  })
  const [newPassword, setNewPassword] = useState('')

  const { kelasOptions, loading: loadingKelas } = useKelasOptions(isOpen && !!user)

  // Reset form when user changes
  useEffect(() => {
    if (!user) return
    const raf = requestAnimationFrame(() => {
      setFormData({
        nama_lengkap: user.nama_lengkap || '',
        email: user.email || '',
        role: (user.role as 'guru' | 'siswa') || 'guru',
        status: user.status !== false,
        kelas_id: user.kelas_id || '',
        nip: user.nip || '',
        nis: user.nis || '',
      })
      setNewPassword('')
    })
    return () => cancelAnimationFrame(raf)
  }, [user])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    const err = validateUserEdit({ nama_lengkap: formData.nama_lengkap, email: formData.email, password: newPassword || undefined })
    if (err) { setLocalError(err); return }
    setLocalError(null)
    await onSubmit({ ...formData, password: newPassword || undefined, id: user.id })
  }

  const handleChange = (field: keyof EditUserFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }))
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Pengguna"
      size="md"
    >
      {user && (
        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Error validasi lokal */}
          {localError && (
            <FeedbackMessage type="error" message={localError} />
          )}

          {/* Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <Pencil className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900">{user.nama_lengkap}</h3>
              <p className="text-xs text-gray-500">{user.email}</p>
            </div>
          </div>

          {/* Nama Lengkap */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Nama Lengkap
            </label>
            <Input
              type="text"
              value={formData.nama_lengkap}
              onChange={handleChange('nama_lengkap')}
              required
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Email Sekolah
            </label>
            <Input
              type="email"
              value={formData.email}
              onChange={handleChange('email')}
              required
            />
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Role / Peran
            </label>
            <div className="relative">
              <select
                value={formData.role}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    role: e.target.value as 'guru' | 'siswa',
                  }))
                }
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                <option value="guru">Guru</option>
                <option value="siswa">Siswa</option>
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
          </div>

          {/* NIP (khusus guru) */}
          {formData.role === 'guru' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                NIP <span className="text-gray-400 font-medium normal-case">(opsional)</span>
              </label>
              <Input
                type="text"
                placeholder="Contoh: 198512152010011020"
                value={formData.nip}
                onChange={handleChange('nip')}
              />
            </div>
          )}

          {/* NIS (khusus siswa) */}
          {formData.role === 'siswa' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                NIS <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                placeholder="Contoh: 1234567890"
                value={formData.nis}
                onChange={handleChange('nis')}
                required
              />
            </div>
          )}

          {/* Kelas (khusus siswa) */}
          {formData.role === 'siswa' && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                Kelas <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={formData.kelas_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, kelas_id: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer disabled:opacity-60"
                  disabled={loadingKelas}
                  required
                >
                  <option value="">-- Pilih Kelas --</option>
                  {kelasOptions.map((k) => (
                    <option key={k.id} value={k.id}>
                      Kelas {k.tingkat} {k.nama_kelas}
                    </option>
                  ))}
                </select>
                <GraduationCap className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              </div>
              {loadingKelas && <p className="text-xs text-gray-400">Memuat daftar kelas...</p>}
            </div>
          )}

          {/* Status */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Status
            </label>
            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={formData.status === true}
                  onChange={() => setFormData((prev) => ({ ...prev, status: true }))}
                  className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700">Aktif</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={formData.status === false}
                  onChange={() => setFormData((prev) => ({ ...prev, status: false }))}
                  className="h-4 w-4 text-gray-600 focus:ring-gray-500"
                />
                <span className="text-sm text-gray-700">Nonaktif</span>
              </label>
            </div>
          </div>

          {/* Reset Password (opsional) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
              Password Baru <span className="text-gray-400 font-medium normal-case">(opsional)</span>
            </label>
            <Input
              type="password"
              placeholder="Biarkan kosong jika tidak ingin mengubah"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            <p className="text-xs text-gray-400 mt-1">Minimal 6 karakter. Kosongkan untuk mempertahankan password lama.</p>
          </div>

          {user.role === 'guru' && (
            <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
              <strong>Catatan:</strong> Untuk mengatur mata pelajaran dan kelas yang diampu guru ini, buka menu <strong>Mata Pelajaran</strong> → pilih mapel → Detail → Guru Pengampu.
            </div>
          )}

          {/* Buttons */}
          <div className="pt-4 flex items-center space-x-3 border-t border-gray-100 mt-2">
            <Button type="button" variant="secondary" onClick={onClose} fullWidth size="md">
              Batal
            </Button>
            <Button type="submit" loading={submitting} disabled={submitting} fullWidth size="md">
              {submitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.5 0 0 5.5 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.134 5.824 3 7.937l3-2.647z" />
                  </svg>
                  Menyimpan...
                </span>
              ) : (
                'Simpan Perubahan'
              )}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}

'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { Profile } from '@/components/admin/UserTable'

interface EditUserFormData {
  nama_lengkap: string
  email: string
  role: 'guru' | 'siswa'
  status: boolean
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
  const [formData, setFormData] = useState<EditUserFormData>({
    nama_lengkap: '',
    email: '',
    role: 'guru',
    status: true,
  })

  // Reset form when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        nama_lengkap: user.nama_lengkap || '',
        email: user.email || '',
        role: (user.role as 'guru' | 'siswa') || 'guru',
        status: user.status !== false,
      })
    }
  }, [user])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    await onSubmit({ ...formData, id: user.id })
  }

  const handleChange = (field: keyof EditUserFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }))
  }

  if (!user) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Pengguna" size="md">
      <form onSubmit={handleSubmit} className="space-y-5 pt-2">
        {/* Info User */}
        <div className="bg-blue-50 rounded-xl p-4 mb-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
            {user.nama_lengkap?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{user.nama_lengkap || 'Tanpa Nama'}</p>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        </div>

        {/* Nama Lengkap */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
            Nama Lengkap <span className="text-red-500">*</span>
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
            Email Sekolah <span className="text-red-500">*</span>
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
            Role / Peran <span className="text-red-500">*</span>
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
              <option value="guru">👨‍🏫 Guru</option>
              <option value="siswa">🎓 Siswa</option>
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

        {/* Status */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
            Status Akun
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, status: true }))}
              className={`
                px-4 py-3 rounded-xl text-sm font-bold transition-all
                flex items-center justify-center gap-2
                ${
                  formData.status
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
              `}
            >
              <span className={`w-2 h-2 rounded-full ${formData.status ? 'bg-white' : 'bg-gray-400'}`} />
              Aktif
            </button>
            <button
              type="button"
              onClick={() => setFormData((prev) => ({ ...prev, status: false }))}
              className={`
                px-4 py-3 rounded-xl text-sm font-bold transition-all
                flex items-center justify-center gap-2
                ${
                  !formData.status
                    ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }
              `}
            >
              <span className={`w-2 h-2 rounded-full ${!formData.status ? 'bg-white' : 'bg-gray-400'}`} />
              Nonaktif
            </button>
          </div>
        </div>

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
    </Modal>
  )
}

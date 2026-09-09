'use client'

import { useState, type FormEvent } from 'react'
import { UserPlus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface CreateUserFormData {
  nama_lengkap: string
  email: string
  password: string
  role: 'guru' | 'siswa'
}

interface CreateUserModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateUserFormData) => Promise<void>
  submitting?: boolean
}

export function CreateUserModal({
  isOpen,
  onClose,
  onSubmit,
  submitting = false,
}: CreateUserModalProps) {
  const [formData, setFormData] = useState<CreateUserFormData>({
    nama_lengkap: '',
    email: '',
    password: '',
    role: 'guru',
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  const handleChange = (field: keyof CreateUserFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tambah Pengguna Baru" size="md">
      <form onSubmit={handleSubmit} className="space-y-5 pt-2">
        {/* Nama Lengkap */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
            Nama Lengkap <span className="text-red-500">*</span>
          </label>
          <Input
            type="text"
            placeholder="Contoh: Budi Santoso, S.Pd"
            value={formData.nama_lengkap}
            onChange={handleChange('nama_lengkap')}
            icon={<UserPlus className="h-5 w-5" />}
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
            placeholder="budi@sekolah.sch.id"
            value={formData.email}
            onChange={handleChange('email')}
            required
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
            Password <span className="text-red-500">*</span>
          </label>
          <Input
            type="password"
            placeholder="Minimal 6 karakter"
            value={formData.password}
            onChange={handleChange('password')}
            required
          />
          <p className="text-xs text-gray-400 mt-1">Minimal 6 karakter</p>
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
              'Simpan Akun'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

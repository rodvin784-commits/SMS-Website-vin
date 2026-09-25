'use client'

import { useState, useEffect, useRef, type FormEvent } from 'react'
import { UserPlus, GraduationCap } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useKelasOptions } from '@/hooks/useKelasOptions'
import { validateUserCreate } from '@/lib/user-validation'
import { generateSchoolEmail, getSchoolEmailDomain } from '@/lib/school-email'

interface CreateUserFormData {
  nama_lengkap: string
  email: string
  password: string
  role: 'guru' | 'siswa'
  kelas_id: string
  nip: string
  nis: string
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
    kelas_id: '',
    nip: '',
    nis: '',
  })

  const { kelasOptions, loading: loadingKelas } = useKelasOptions(isOpen)
  // Track apakah email pernah diedit manual — jika true, auto tidak overwrite lagi
  const [emailEdited, setEmailEdited] = useState(false)
  const prevNamaRef = useRef('')

  // Reset form when modal opens
  useEffect(() => {
    if (!isOpen) return
    const raf = requestAnimationFrame(() => {
      setFormData({ nama_lengkap: '', email: '', password: '', role: 'guru', kelas_id: '', nip: '', nis: '' })
      setEmailEdited(false)
      prevNamaRef.current = ''
    })
    return () => cancelAnimationFrame(raf)
  }, [isOpen])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    // siswa: password boleh kosong (auto di server)
    const err = validateUserCreate({ nama_lengkap: formData.nama_lengkap, email: formData.email, password: formData.password, role: formData.role, nis: formData.nis, kelas_id: formData.kelas_id })
    if (err) { alert(err); return }
    // kirim dengan password auto jika siswa kosong (server juga auto, tapi konsisten)
    const payload = { ...formData }
    if (payload.role === 'siswa' && !payload.password) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
      let rnd = ''; for (let i=0;i<12;i++) rnd+=chars[Math.floor(Math.random()*chars.length)]
      payload.password = rnd
    }
    await onSubmit(payload)
  }

  const handleChange = (field: keyof CreateUserFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const val = e.target.value
    // Auto-generate email dari nama lengkap (aman: tidak overwrite jika user sudah edit manual)
    if (field === 'nama_lengkap') {
      const autoEmail = generateSchoolEmail(val)
      setFormData((prev) => {
        const shouldAuto = !emailEdited && (!prev.email || prev.email === generateSchoolEmail(prevNamaRef.current))
        prevNamaRef.current = val
        if (shouldAuto) {
          if (autoEmail) return { ...prev, nama_lengkap: val, email: autoEmail }
          // nama dikosongkan → kosongkan email auto juga
          if (!val.trim()) return { ...prev, nama_lengkap: val, email: '' }
        }
        return { ...prev, nama_lengkap: val }
      })
      return
    }
    if (field === 'email') {
      // user ketik email manual → tandai edited, tapi jika dikosongkan reset flag
      setEmailEdited(val.trim() !== '' && val !== generateSchoolEmail(formData.nama_lengkap))
      // kosongkan → auto aktif lagi
      if (val.trim() === '') setEmailEdited(false)
      prevNamaRef.current = formData.nama_lengkap
    }
    setFormData((prev) => ({ ...prev, [field]: val }))
  }

  const handleRegenerateEmail = () => {
    const auto = generateSchoolEmail(formData.nama_lengkap)
    if (!auto) { alert('Isi Nama Lengkap dulu untuk generate email'); return }
    setFormData((prev) => ({ ...prev, email: auto }))
    setEmailEdited(false)
    prevNamaRef.current = formData.nama_lengkap
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tambah Pengguna Baru"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-5 pt-2">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-gray-900">Data Pengguna</h3>
            <p className="text-xs text-gray-500">Isi data diri pengguna baru</p>
          </div>
        </div>

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
            required
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
            Email Sekolah <span className="text-red-500">*</span>
            <span className="ml-2 text-[10px] font-normal normal-case text-gray-400">otomatis dari nama, bisa diedit</span>
          </label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder={`budi.santoso@${getSchoolEmailDomain()}`}
              value={formData.email}
              onChange={handleChange('email')}
              required
            />
            <button
              type="button"
              onClick={handleRegenerateEmail}
              title="Generate ulang dari nama"
              className="shrink-0 px-3 py-2 text-xs font-semibold border border-gray-200 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700"
            >
              ↻ Auto
            </button>
          </div>
          <p className="text-[11px] text-gray-400">Domain: <span className="font-mono">{getSchoolEmailDomain()}</span> · ganti via <span className="font-mono">NEXT_PUBLIC_SCHOOL_EMAIL_DOMAIN</span> di .env.local</p>
        </div>

        {/* Password — siswa Google OAuth bisa kosong (auto 12 char), guru wajib */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
            Password {formData.role === 'siswa' ? <span className="text-gray-400 font-medium normal-case">(opsional, auto jika kosong — untuk Google)</span> : <span className="text-red-500">*</span>}
          </label>
          <Input
            type="password"
            placeholder={formData.role === 'siswa' ? 'Kosongkan untuk auto (Google login)' : 'Minimal 6 karakter'}
            value={formData.password}
            onChange={handleChange('password')}
            required={formData.role === 'guru'}
          />
          <p className="text-xs text-gray-400 mt-1">{formData.role === 'siswa' ? 'Siswa login via Google @smk.belajar.id, password tidak dipakai — kosongkan saja.' : 'Minimal 6 karakter'}</p>
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
                  kelas_id: e.target.value === 'guru' ? '' : prev.kelas_id,
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

        {/* Info */}
        {formData.role === 'guru' && (
          <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
            <strong>Catatan:</strong> Setelah akun guru dibuat, atur mata pelajaran dan kelas dari menu <strong>Mata Pelajaran</strong> → Detail → Guru Pengampu.
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
              'Simpan Akun'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

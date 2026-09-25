// Shared validation untuk Create/Edit user — DRY (dipakai page + modal)
import { EMAIL_RE } from '@/lib/utils'

export function validateUserCreate(data: { nama_lengkap: string; email: string; password: string; role: string; nis?: string; kelas_id?: string }): string | null {
  if (!data.nama_lengkap?.trim()) return 'Nama lengkap wajib diisi'
  if (!EMAIL_RE.test(data.email)) return 'Email tidak valid'
  // Siswa Google OAuth: password opsional (auto-random 12 char di server), guru wajib
  if (data.role === 'siswa') {
    if (data.password && data.password.length > 0 && data.password.length < 6) return 'Password minimal 6 karakter (kosongkan untuk auto Google)'
  } else {
    if (!data.password || data.password.length < 6) return 'Password minimal 6 karakter'
  }
  if (data.role === 'siswa' && !data.nis?.trim()) return 'NIS wajib untuk siswa'
  if (data.role === 'siswa' && !data.kelas_id) return 'Kelas wajib untuk siswa'
  return null
}

export function validateUserEdit(data: { nama_lengkap: string; email: string; password?: string }): string | null {
  if (!data.nama_lengkap?.trim()) return 'Nama lengkap wajib diisi'
  if (!EMAIL_RE.test(data.email)) return 'Email tidak valid'
  if (data.password && data.password.length < 6) return 'Password baru minimal 6 karakter'
  return null
}

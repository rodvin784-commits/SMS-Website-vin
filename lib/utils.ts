// Shared utils — DRY untuk pickOne & helper umum (P2 clean code)
// Dipakai di: guru-auth, admin/*, teacher/*, siswa-query
export const pickOne = <T,>(v: T[] | T | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

export function formatTanggalLengkap(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

export function sanitizeFileName(name: string, max = 200): string {
  return name.replace(/[\r\n"]/g, '').slice(0, max) || 'file'
}

export const TAHUN_AJARAN_RE = /^\d{4}\/\d{4}$/
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

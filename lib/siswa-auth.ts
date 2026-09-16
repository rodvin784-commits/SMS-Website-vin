import { getProfileRole, getSessionUser, getSupabaseAdmin } from '@/lib/supabase-server'

// Sumber kebenaran sesi siswa:
// auth.uid() -> profiles (role=siswa, status aktif) -> siswa (id siswa, kelas_id) -> data kelas.
//
// Semua API siswa memakai helper ini. Verifikasi dilakukan server-side
// (bukan sekadar filter frontend), sesuai DATABASE_CONTEXT.md.

export type SiswaAuthResult =
  | { ok: true; userId: string; siswaId: string; kelasId: string }
  | { ok: false; status: number; error: string }

// Validasi sesi siswa aktif dan resolve id baris tabel `siswa` + kelas miliknya.
// Catatan: header Authorization (Bearer token dari aplikasi mobile) dibaca otomatis
// oleh getSessionUser() via next/headers — route tidak perlu meneruskan request.
export async function siswaAuth(): Promise<SiswaAuthResult> {
  try {
    const user = await getSessionUser()
    if (!user) {
      return { ok: false, status: 401, error: 'Belum login.' }
    }

    const profile = await getProfileRole(user.id)
    if (profile.role !== 'siswa' || profile.status === false) {
      return { ok: false, status: 403, error: 'Tidak diizinkan. Hanya siswa aktif.' }
    }

    const { data: siswaRow, error } = await getSupabaseAdmin()
      .from('siswa')
      .select('id, kelas_id')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (error) {
      return { ok: false, status: 400, error: error.message }
    }
    if (!siswaRow || !siswaRow.kelas_id) {
      return {
        ok: false,
        status: 403,
        error: 'Data siswa tidak ditemukan. Hubungi admin untuk melengkapi data Anda.',
      }
    }

    return { ok: true, userId: user.id, siswaId: siswaRow.id, kelasId: siswaRow.kelas_id }
  } catch (err) {
    console.error('siswaAuth error:', err)
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'Terjadi kesalahan server',
    }
  }
}

// Informasi kelas milik siswa (nama_kelas, tingkat, tahun_ajaran).
export async function getSiswaKelasInfo(kelasId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('kelas')
    .select('id, nama_kelas, tingkat, tahun_ajaran')
    .eq('id', kelasId)
    .maybeSingle()

  if (error || !data) {
    return { nama_kelas: null, tingkat: null, tahun_ajaran: null }
  }
  return {
    id: data.id,
    nama_kelas: data.nama_kelas,
    tingkat: data.tingkat,
    tahun_ajaran: data.tahun_ajaran,
  }
}
import { getProfileRole, getSessionUser, getSupabaseAdmin } from '@/lib/supabase-server'

// Sumber kebenaran sesi guru:
// auth.uid() -> profiles (role=guru, status aktif) -> guru (id guru) -> guru_kelas (penugasan)
//
// Semua API teacher memakai helper ini. Verifikasi dilakukan server-side
// (bukan sekadar filter frontend), sesuai DATABASE_CONTEXT.md.

export type GuruAuthResult =
  | { ok: true; userId: string; guruId: string }
  | { ok: false; status: number; error: string }

// Validasi sesi guru aktif dan resolve id baris tabel `guru` miliknya.
export async function guruAuth(): Promise<GuruAuthResult> {
  try {
    const user = await getSessionUser()
    if (!user) {
      return { ok: false, status: 401, error: 'Belum login.' }
    }

    const profile = await getProfileRole(user.id)
    if (profile.role !== 'guru' || profile.status === false) {
      return { ok: false, status: 403, error: 'Tidak diizinkan. Hanya guru aktif.' }
    }

    const { data: guruRow, error } = await getSupabaseAdmin()
      .from('guru')
      .select('id')
      .eq('profile_id', user.id)
      .maybeSingle()

    if (error) {
      return { ok: false, status: 400, error: error.message }
    }
    if (!guruRow) {
      return {
        ok: false,
        status: 403,
        error: 'Data guru tidak ditemukan. Hubungi admin untuk melengkapi data Anda.',
      }
    }

    return { ok: true, userId: user.id, guruId: guruRow.id }
  } catch (err) {
    console.error('guruAuth error:', err)
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'Terjadi kesalahan server',
    }
  }
}

export type GuruKelasRow = {
  id: string
  guru_id: string
  kelas_id: string
  mata_pelajaran_id: string
  tahun_ajaran: string | null
  mapel_nama: string | null
  mapel_kode: string | null
  kelas_nama: string | null
  tingkat: number | null
}

// Semua penugasan (guru_kelas) milik guru: guru + mapel + kelas + tahun ajaran.
export async function getGuruKelas(guruId: string): Promise<GuruKelasRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('guru_kelas')
    .select(`
      id,
      guru_id,
      kelas_id,
      mata_pelajaran_id,
      tahun_ajaran,
      mata_pelajaran(nama, kode),
      kelas(nama_kelas, tingkat)
    `)
    .eq('guru_id', guruId)

  if (error) {
    console.error('Gagal memuat guru_kelas:', error.message)
    return []
  }

  type Embed = {
    id: string
    guru_id: string
    kelas_id: string
    mata_pelajaran_id: string
    tahun_ajaran: string | null
    mata_pelajaran: { nama: string; kode: string } | { nama: string; kode: string }[] | null
    kelas: { nama_kelas: string; tingkat: number } | { nama_kelas: string; tingkat: number }[] | null
  }

  const pickOne = <T,>(v: T[] | T | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

  return ((data ?? []) as unknown as Embed[]).map((r) => {
    const mapel = pickOne(r.mata_pelajaran)
    const kelas = pickOne(r.kelas)
    return {
      id: r.id,
      guru_id: r.guru_id,
      kelas_id: r.kelas_id,
      mata_pelajaran_id: r.mata_pelajaran_id,
      tahun_ajaran: r.tahun_ajaran ?? null,
      mapel_nama: mapel?.nama ?? null,
      mapel_kode: mapel?.kode ?? null,
      kelas_nama: kelas?.nama_kelas ?? null,
      tingkat: kelas?.tingkat ?? null,
    }
  })
}

// Cek apakah pasangan (mapel, kelas) benar-benar ditugaskan ke guru ini.
// Dipakai sebelum INSERT tugas/materi/video/pengumuman/nilai ke kelas tertentu.
export async function isAssigned(
  guruId: string,
  mapelId: string,
  kelasId: string
): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from('guru_kelas')
    .select('id')
    .eq('guru_id', guruId)
    .eq('mata_pelajaran_id', mapelId)
    .eq('kelas_id', kelasId)
    .limit(1)

  if (error) {
    console.error('Gagal cek penugasan guru:', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}

// Roster siswa aktif satu kelas (dari tabel siswa, bukan profiles).
export async function getSiswaKelas(kelasId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('siswa')
    .select('id, nis, nama_lengkap')
    .eq('kelas_id', kelasId)
    .order('nama_lengkap', { ascending: true })

  if (error) {
    console.error('Gagal memuat siswa kelas:', error.message)
    return []
  }
  return data ?? []
}

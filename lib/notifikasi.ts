import { getSupabaseAdmin } from '@/lib/supabase-server'

// Pembuatan notifikasi untuk siswa (tabel `notifikasi`, DATABASE_CONTEXT.md #21).
// Best-effort: kegagalan insert notifikasi dicatat tapi tidak menggagalkan alur utama.

export type NotifData = {
  judul: string
  pesan: string
  tipe: string
  referensiId?: string | null
}

export async function kirimNotifikasiKeProfileIds(profileIds: string[], notif: NotifData): Promise<void> {
  const ids = profileIds.filter(Boolean)
  if (ids.length === 0) return
  try {
    const { error } = await getSupabaseAdmin()
      .from('notifikasi')
      .insert(
        ids.map((profile_id) => ({
          profile_id,
          judul: notif.judul,
          pesan: notif.pesan,
          tipe: notif.tipe,
          referensi_id: notif.referensiId ?? null,
          is_read: false,
        }))
      )
    if (error) console.error('Gagal membuat notifikasi:', error.message)
  } catch (err) {
    console.error('Gagal membuat notifikasi:', err)
  }
}

// Kirim notifikasi ke seluruh siswa di kelas-kelas target.
export async function kirimNotifikasiKeKelas(kelasIds: string[], notif: NotifData): Promise<void> {
  if (kelasIds.length === 0) return
  try {
    const { data: siswaList, error } = await getSupabaseAdmin()
      .from('siswa')
      .select('profile_id')
      .in('kelas_id', kelasIds)
    if (error) {
      console.error('Gagal memuat siswa untuk notifikasi:', error.message)
      return
    }
    const profileIds = ((siswaList ?? []) as { profile_id: string | null }[])
      .map((s) => s.profile_id)
      .filter((p): p is string => Boolean(p))
    await kirimNotifikasiKeProfileIds(profileIds, notif)
  } catch (err) {
    console.error('Gagal membuat notifikasi:', err)
  }
}

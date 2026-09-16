import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { guruAuth, getGuruKelas } from '@/lib/guru-auth'

// GET /api/teacher/mengajar
// Penugasan mengajar milik guru yang login (dari guru_kelas): mapel + kelas + tahun ajaran.
// Termasuk penanda apakah guru adalah wali kelas suatu kelas (kolom kelas.wali_kelas_id —
// jika kolom ini tidak ada di database, fitur wali kelas otomatis tersembunyi).
export async function GET() {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const assignments = await getGuruKelas(auth.guruId)

    // Cek apakah kolom wali_kelas_id tersedia di tabel kelas.
    let waliKelas: {
      kelas_id: string
      nama_kelas: string | null
      tingkat: number | null
      tahun_ajaran: string | null
    } | null = null

    try {
      const { data, error } = await getSupabaseAdmin()
        .from('kelas')
        .select('id, nama_kelas, tingkat, tahun_ajaran')
        .eq('wali_kelas_id', auth.userId)
        .limit(1)

      if (!error && data && data.length > 0) {
        waliKelas = {
          kelas_id: data[0].id,
          nama_kelas: data[0].nama_kelas ?? null,
          tingkat: data[0].tingkat ?? null,
          tahun_ajaran: data[0].tahun_ajaran ?? null,
        }
      }
    } catch {
      // Kolom wali_kelas_id belum ada di tabel kelas — abaikan (fitur wali kelas tersembunyi).
    }

    return NextResponse.json({ assignments, wali_kelas: waliKelas })
  } catch (err) {
    console.error('Error listing teacher assignments:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

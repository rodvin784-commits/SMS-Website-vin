import { NextResponse } from 'next/server'
import { getProfileRole, getSessionUser, getSupabaseAdmin } from '@/lib/supabase-server'

type MapelEmbed = { nama: string; kode: string }[] | { nama: string; kode: string } | null
type KelasEmbed =
  | { nama_kelas: string; tingkat: number; tahun_ajaran: string }[]
  | { nama_kelas: string; tingkat: number; tahun_ajaran: string }
  | null

type MengajarRow = {
  id: string
  mapel_id: string
  kelas_id: string
  materi: string | null
  mata_pelajaran: MapelEmbed
  kelas: KelasEmbed
}

// GET /api/teacher/mengajar -> penugasan mengajar guru yang sedang login
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Belum login' }, { status: 401 })
    }

    const profile = await getProfileRole(user.id)
    if (profile.role !== 'guru' || profile.status === false) {
      return NextResponse.json({ error: 'Tidak diizinkan. Hanya guru aktif.' }, { status: 403 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('guru_mengajar')
      .select('id, materi, mapel_id, kelas_id, mata_pelajaran(nama, kode), kelas(nama_kelas, tingkat, tahun_ajaran)')
      .eq('guru_id', user.id)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const assignments = (data ?? []).map((r) => {
      const row = r as unknown as MengajarRow
      const mapel = Array.isArray(row.mata_pelajaran) ? row.mata_pelajaran[0] : row.mata_pelajaran
      const kelas = Array.isArray(row.kelas) ? row.kelas[0] : row.kelas
      return {
        id: row.id,
        mapel_id: row.mapel_id,
        mapel_nama: mapel?.nama ?? null,
        mapel_kode: mapel?.kode ?? null,
        kelas_id: row.kelas_id,
        kelas_nama: kelas?.nama_kelas ?? null,
        tingkat: kelas?.tingkat ?? null,
        tahun_ajaran: kelas?.tahun_ajaran ?? null,
        materi: row.materi ?? null
      }
    })

    return NextResponse.json({ assignments })
  } catch (err) {
    console.error('Error listing teacher mengajar:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

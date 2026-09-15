import { NextResponse } from 'next/server'
import { getProfileRole, getSessionUser, getSupabaseAdmin } from '@/lib/supabase-server'

type MapelEmbed = { nama: string; kode: string }[] | { nama: string; kode: string } | null
type KelasEmbed =
  | { nama_kelas: string; tingkat: number }[]
  | { nama_kelas: string; tingkat: number }
  | null

type JadwalRow = {
  id: string
  hari: number
  jam_mulai: string
  jam_selesai: string
  ruangan: string | null
  guru_mengajar_id: string
  guru_mengajar: {
    semester: string | null
    mata_pelajaran: MapelEmbed
    kelas: KelasEmbed
  } | null
}

const pickOne = <T,>(v: T[] | T | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

// GET /api/teacher/jadwal -> jadwal mingguan milik guru yang login (terurut hari + jam)
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
      .from('jadwal_pelajaran')
      .select(`
        id,
        hari,
        jam_mulai,
        jam_selesai,
        ruangan,
        guru_mengajar_id,
        guru_mengajar(
          semester,
          mata_pelajaran(nama, kode),
          kelas(nama_kelas, tingkat)
        )
      `)
      .eq('guru_mengajar.guru_id', user.id)
      .order('hari', { ascending: true })
      .order('jam_mulai', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const jadwal = ((data ?? []) as unknown as JadwalRow[]).map((r) => {
      const mapel = pickOne(r.guru_mengajar?.mata_pelajaran)
      const kelas = pickOne(r.guru_mengajar?.kelas)
      return {
        id: r.id,
        hari: r.hari,
        jam_mulai: r.jam_mulai,
        jam_selesai: r.jam_selesai,
        ruangan: r.ruangan ?? null,
        semester: r.guru_mengajar?.semester ?? null,
        mapel_nama: mapel?.nama ?? null,
        mapel_kode: mapel?.kode ?? null,
        kelas_nama: kelas?.nama_kelas ?? null,
        tingkat: kelas?.tingkat ?? null,
      }
    })

    return NextResponse.json({ jadwal })
  } catch (err) {
    console.error('Error listing teacher jadwal:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
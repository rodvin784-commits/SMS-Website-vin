import { NextResponse } from 'next/server'
import { getProfileRole, getSessionUser, getSupabaseAdmin } from '@/lib/supabase-server'

type MapelEmbed = { nama: string; kode: string }[] | { nama: string; kode: string } | null
type GuruEmbed =
  | { nama_lengkap: string }[]
  | { nama_lengkap: string }
  | null

type JadwalRow = {
  id: string
  hari: number
  jam_mulai: string
  jam_selesai: string
  ruangan: string | null
  guru_mengajar: {
    semester: string | null
    mata_pelajaran: MapelEmbed
    guru: GuruEmbed
  } | null
}

const pickOne = <T,>(v: T[] | T | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

// GET /api/siswa/jadwal -> jadwal mingguan kelas milik siswa yang login
export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Belum login' }, { status: 401 })
    }

    const profile = await getProfileRole(user.id)
    if (profile.role !== 'siswa' || profile.status === false) {
      return NextResponse.json({ error: 'Tidak diizinkan. Hanya siswa aktif.' }, { status: 403 })
    }

    const { data: prof } = await getSupabaseAdmin()
      .from('profiles')
      .select('kelas_id')
      .eq('id', user.id)
      .maybeSingle()

    if (!prof?.kelas_id) {
      return NextResponse.json({ error: 'Belum terdaftar di kelas manapun.' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('jadwal_pelajaran')
      .select(`
        id,
        hari,
        jam_mulai,
        jam_selesai,
        ruangan,
        guru_mengajar(
          semester,
          mata_pelajaran(nama, kode),
          guru:profiles!guru_id(nama_lengkap)
        )
      `)
      .eq('guru_mengajar.kelas_id', prof.kelas_id)
      .order('hari', { ascending: true })
      .order('jam_mulai', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const jadwal = ((data ?? []) as unknown as JadwalRow[]).map((r) => {
      const mapel = pickOne(r.guru_mengajar?.mata_pelajaran)
      const guru = pickOne(r.guru_mengajar?.guru)
      return {
        id: r.id,
        hari: r.hari,
        jam_mulai: r.jam_mulai,
        jam_selesai: r.jam_selesai,
        ruangan: r.ruangan ?? null,
        semester: r.guru_mengajar?.semester ?? null,
        mapel_nama: mapel?.nama ?? null,
        mapel_kode: mapel?.kode ?? null,
        guru_nama: guru?.nama_lengkap ?? null,
      }
    })

    return NextResponse.json({ kelas_id: prof.kelas_id, jadwal })
  } catch (err) {
    console.error('Error GET siswa jadwal:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
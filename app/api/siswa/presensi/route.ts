import { NextResponse } from 'next/server'
import { getProfileRole, getSessionUser, getSupabaseAdmin } from '@/lib/supabase-server'

type MapelEmbed = { nama: string }[] | { nama: string } | null
type KelasEmbed = { nama_kelas: string }[] | { nama_kelas: string } | null

type PresensiRow = {
  id: string
  tanggal: string
  status: string
  keterangan: string | null
  guru_mengajar: {
    semester: string | null
    mata_pelajaran: MapelEmbed
    kelas: KelasEmbed
  } | null
}

const pickOne = <T,>(v: T[] | T | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

// GET /api/siswa/presensi -> riwayat presensi siswa + ringkasan kehadiran
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

    const { data, error } = await getSupabaseAdmin()
      .from('presensi')
      .select(`
        id,
        tanggal,
        status,
        keterangan,
        guru_mengajar(
          semester,
          mata_pelajaran(nama),
          kelas(nama_kelas)
        )
      `)
      .eq('siswa_id', user.id)
      .order('tanggal', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const riwayat = ((data ?? []) as unknown as PresensiRow[]).map((r) => {
      const mapel = pickOne(r.guru_mengajar?.mata_pelajaran)
      const kelas = pickOne(r.guru_mengajar?.kelas)
      return {
        id: r.id,
        tanggal: r.tanggal,
        status: r.status,
        keterangan: r.keterangan ?? null,
        semester: r.guru_mengajar?.semester ?? null,
        mapel_nama: mapel?.nama ?? null,
        kelas_nama: kelas?.nama_kelas ?? null,
      }
    })

    const summary: Record<string, number> = {
      hadir: 0,
      terlambat: 0,
      izin: 0,
      sakit: 0,
      alfa: 0,
    }
    for (const r of riwayat) {
      if (r.status in summary) summary[r.status] += 1
    }

    return NextResponse.json({ riwayat, summary })
  } catch (err) {
    console.error('Error GET siswa presensi:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
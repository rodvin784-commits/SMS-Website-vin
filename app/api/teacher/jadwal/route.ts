import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { guruAuth, getGuruKelas } from '@/lib/guru-auth'

// GET /api/teacher/jadwal
// Jadwal mengajar mingguan milik guru yang login, dari tabel `jadwal`
// (hari TEXT: Senin..Sabtu, jam_mulai/jam_selesai TIME, ruangan, tahun_ajaran).
export async function GET() {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const penugasan = await getGuruKelas(auth.guruId)
    if (penugasan.length === 0) {
      return NextResponse.json({ jadwal: [] })
    }

    // Jadwal guru tidak berelasi langsung ke guru_kelas; filter berdasarkan
    // pasangan (mata_pelajaran_id, kelas_id) yang terdapat pada guru_kelas.
    const pasangan = new Set(penugasan.map((p) => `${p.mata_pelajaran_id}|${p.kelas_id}`))

    const { data, error } = await getSupabaseAdmin()
      .from('jadwal')
      .select(`
        id,
        hari,
        jam_mulai,
        jam_selesai,
        ruangan,
        tahun_ajaran,
        mata_pelajaran_id,
        kelas_id,
        mata_pelajaran(nama, kode),
        kelas(nama_kelas, tingkat)
      `)
      .eq('guru_id', auth.guruId)
      .order('jam_mulai', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    type Embed = {
      id: string
      hari: string | null
      jam_mulai: string | null
      jam_selesai: string | null
      ruangan: string | null
      tahun_ajaran: string | null
      mata_pelajaran_id: string
      kelas_id: string
      mata_pelajaran: { nama: string; kode: string } | { nama: string; kode: string }[] | null
      kelas: { nama_kelas: string; tingkat: number } | { nama_kelas: string; tingkat: number }[] | null
    }

    const pickOne = <T,>(v: T[] | T | null | undefined): T | null =>
      Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

    const jadwal = ((data ?? []) as unknown as Embed[])
      .filter((r) => pasangan.has(`${r.mata_pelajaran_id}|${r.kelas_id}`))
      .map((r) => {
        const mapel = pickOne(r.mata_pelajaran)
        const kelas = pickOne(r.kelas)
        return {
          id: r.id,
          hari: r.hari ?? '',
          jam_mulai: r.jam_mulai ?? '',
          jam_selesai: r.jam_selesai ?? '',
          ruangan: r.ruangan ?? null,
          tahun_ajaran: r.tahun_ajaran ?? null,
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

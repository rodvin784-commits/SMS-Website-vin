import { NextResponse } from 'next/server'
import { getProfileRole, getSessionUser, getSupabaseAdmin } from '@/lib/supabase-server'

const JENIS: ['harian', 'tugas', 'uts', 'uas'] = ['harian', 'tugas', 'uts', 'uas']

type MapelEmbed = { nama: string; kode: string }[] | { nama: string; kode: string } | null
type GuruEmbed = { nama_lengkap: string }[] | { nama_lengkap: string } | null

type AssignmentRow = {
  id: string
  semester: string | null
  mapel_id: string
  mata_pelajaran: MapelEmbed
  guru: GuruEmbed
}

type NilaiRow = {
  guru_mengajar_id: string
  jenis_nilai: string
  nilai: number
}

const pickOne = <T,>(v: T[] | T | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

function isJenis(v: string): v is (typeof JENIS)[number] {
  return (JENIS as string[]).includes(v)
}

function predikat(nilai: number): string {
  if (nilai >= 90) return 'A'
  if (nilai >= 80) return 'B'
  if (nilai >= 70) return 'C'
  if (nilai >= 60) return 'D'
  return 'E'
}

// GET /api/siswa/nilai -> nilai seluruh mapel kelas siswa (per komponen + rata-rata)
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
      .select('kelas_id, nama_lengkap')
      .eq('id', user.id)
      .maybeSingle()

    if (!prof?.kelas_id) {
      return NextResponse.json({ error: 'Belum terdaftar di kelas manapun.' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()

    const [kelasRes, asgRes, nilaiRes] = await Promise.all([
      supabase
        .from('kelas')
        .select('nama_kelas, tingkat, tahun_ajaran')
        .eq('id', prof.kelas_id)
        .maybeSingle(),
      supabase
        .from('guru_mengajar')
        .select(`
          id,
          semester,
          mapel_id,
          mata_pelajaran(nama, kode),
          guru:profiles!guru_id(nama_lengkap)
        `)
        .eq('kelas_id', prof.kelas_id)
        .order('created_at', { ascending: true }),
      supabase
        .from('nilai')
        .select('guru_mengajar_id, jenis_nilai, nilai')
        .eq('siswa_id', user.id),
    ])

    if (kelasRes.error) return NextResponse.json({ error: kelasRes.error.message }, { status: 400 })
    if (asgRes.error) return NextResponse.json({ error: asgRes.error.message }, { status: 400 })
    if (nilaiRes.error) return NextResponse.json({ error: nilaiRes.error.message }, { status: 400 })

    // Kelompokkan nilai per penugasan
    const nilaiMap = new Map<string, Partial<Record<(typeof JENIS)[number], number>>>()
    for (const n of (nilaiRes.data ?? []) as NilaiRow[]) {
      if (isJenis(n.jenis_nilai) && typeof n.nilai === 'number') {
        const entry = nilaiMap.get(n.guru_mengajar_id) ?? {}
        entry[n.jenis_nilai] = n.nilai
        nilaiMap.set(n.guru_mengajar_id, entry)
      }
    }

    const mapelList = ((asgRes.data ?? []) as unknown as AssignmentRow[]).map((a) => {
      const mapel = pickOne(a.mata_pelajaran)
      const guru = pickOne(a.guru)
      const m = nilaiMap.get(a.id) ?? {}
      const values = JENIS.map((j) => m[j]).filter((v): v is number => v !== undefined)
      const rata = values.length > 0
        ? Math.round((values.reduce((x, y) => x + y, 0) / values.length) * 100) / 100
        : null
      return {
        mapel_id: a.mapel_id,
        mapel_nama: mapel?.nama ?? null,
        mapel_kode: mapel?.kode ?? null,
        guru_nama: guru?.nama_lengkap ?? null,
        semester: a.semester ?? null,
        nilai: {
          harian: m.harian ?? null,
          tugas: m.tugas ?? null,
          uts: m.uts ?? null,
          uas: m.uas ?? null,
        },
        rata_rata: rata,
        predikat: rata !== null ? predikat(rata) : null,
      }
    })

    const kelas = kelasRes.data
      ? {
          nama_kelas: kelasRes.data.nama_kelas,
          tingkat: kelasRes.data.tingkat,
          tahun_ajaran: kelasRes.data.tahun_ajaran,
        }
      : null

    return NextResponse.json({ siswa: prof.nama_lengkap, kelas, mapel: mapelList })
  } catch (err) {
    console.error('Error GET siswa nilai:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
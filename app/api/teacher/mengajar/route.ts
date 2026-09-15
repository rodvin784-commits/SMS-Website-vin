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
  semester: string | null
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
      .select('id, materi, semester, mapel_id, kelas_id, mata_pelajaran(nama, kode), kelas(nama_kelas, tingkat, tahun_ajaran)')
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
        semester: row.semester ?? null,
        materi: row.materi ?? null
      }
    })

    // Total baris presensi milik guru ini (semua kelas & tanggal)
    const assignmentIds = assignments.map((a) => a.id)
    let presensiTerkirim = 0
    if (assignmentIds.length > 0) {
      const { count } = await getSupabaseAdmin()
        .from('presensi')
        .select('id', { count: 'exact', head: true })
        .in('guru_mengajar_id', assignmentIds)
      presensiTerkirim = count ?? 0
    }

    // Kelas di mana guru ini menjadi wali kelas (berbeda dari penugasan pengampu)
    const { data: waliRows, error: waliError } = await getSupabaseAdmin()
      .from('kelas')
      .select('id, nama_kelas, tingkat, tahun_ajaran, jurusan:jurusan(kode, nama)')
      .eq('wali_kelas_id', user.id)
      .eq('status', true)

    let waliKelas: { id: string; nama_kelas: string; tingkat: number; tahun_ajaran: string; jurusan_nama: string | null } | null = null
    if (waliError) {
      console.error('Gagal memuat wali kelas:', waliError.message)
    } else {
      const row = (waliRows ?? [])[0]
      if (row) {
        const jurusanRaw = (row as unknown as { jurusan?: { kode: string; nama: string } | { kode: string; nama: string }[] | null }).jurusan
        const jurusan = Array.isArray(jurusanRaw) ? jurusanRaw[0] : jurusanRaw
        waliKelas = {
          id: row.id,
          nama_kelas: row.nama_kelas,
          tingkat: row.tingkat,
          tahun_ajaran: row.tahun_ajaran,
          jurusan_nama: jurusan ? `${jurusan.kode} - ${jurusan.nama}` : null,
        }
      }
    }

    return NextResponse.json({ assignments, presensi_terkirim: presensiTerkirim, wali_kelas: waliKelas })
  } catch (err) {
    console.error('Error listing teacher mengajar:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

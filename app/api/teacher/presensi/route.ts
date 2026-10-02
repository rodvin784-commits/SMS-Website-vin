import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { areAllAssigned, getSiswaKelas, guruAuth } from '@/lib/guru-auth'

const STATUS_VALID = ['hadir', 'izin', 'sakit', 'alpha'] as const
type StatusPresensi = (typeof STATUS_VALID)[number]
function isStatus(v: unknown): v is StatusPresensi {
  return typeof v === 'string' && (STATUS_VALID as readonly string[]).includes(v)
}

// GET /api/teacher/presensi?mata_pelajaran_id=&kelas_id=&tanggal=YYYY-MM-DD
export async function GET(request: NextRequest) {
  try {
    const auth = await guruAuth()
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { searchParams } = new URL(request.url)
    const mapelId = searchParams.get('mata_pelajaran_id')
    const kelasId = searchParams.get('kelas_id')
    const tanggal = searchParams.get('tanggal')

    if (!mapelId || !kelasId || !tanggal) {
      return NextResponse.json({ error: 'mata_pelajaran_id, kelas_id, tanggal wajib diisi (YYYY-MM-DD)' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      return NextResponse.json({ error: 'Format tanggal YYYY-MM-DD' }, { status: 400 })
    }
    if (!(await areAllAssigned(auth.guruId, mapelId, [kelasId]))) {
      return NextResponse.json({ error: 'Tidak mengajar mapel/kelas ini' }, { status: 403 })
    }

    const siswa = await getSiswaKelas(kelasId)
    const { data: presensi } = await getSupabaseAdmin()
      .from('presensi')
      .select('id, siswa_id, tanggal, status, keterangan')
      .eq('kelas_id', kelasId)
      .eq('mata_pelajaran_id', mapelId)
      .eq('tanggal', tanggal)

    const map = new Map((presensi ?? []).map((p: { siswa_id: string }) => [p.siswa_id, p]))
    const rows = siswa.map((s: { id: string; nis: string; nama_lengkap: string }) => ({
      siswa_id: s.id,
      nis: s.nis,
      nama_lengkap: s.nama_lengkap,
      presensi: map.get(s.id) ?? null,
    }))

    return NextResponse.json({ siswa: rows, tanggal, kelas_id: kelasId, mata_pelajaran_id: mapelId })
  } catch (err) {
    console.error('GET presensi', err)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

// POST /api/teacher/presensi { mata_pelajaran_id, kelas_id, tanggal, entries: [{siswa_id, status, keterangan?}] }
export async function POST(request: NextRequest) {
  try {
    const auth = await guruAuth()
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await request.json().catch(() => null)
    const mapelId = body?.mata_pelajaran_id ? String(body.mata_pelajaran_id) : ''
    const kelasId = body?.kelas_id ? String(body.kelas_id) : ''
    const tanggal = body?.tanggal ? String(body.tanggal) : ''
    const entries = Array.isArray(body?.entries) ? body.entries : []

    if (!mapelId || !kelasId || !tanggal || entries.length === 0) {
      return NextResponse.json({ error: 'mata_pelajaran_id, kelas_id, tanggal, entries wajib' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return NextResponse.json({ error: 'Format tanggal YYYY-MM-DD' }, { status: 400 })
    if (!(await areAllAssigned(auth.guruId, mapelId, [kelasId]))) {
      return NextResponse.json({ error: 'Tidak mengajar mapel/kelas ini' }, { status: 403 })
    }

    // Validasi entries & pastikan siswa memang di kelas ini
    const siswaList = await getSiswaKelas(kelasId)
    const validIds = new Set(siswaList.map((s: { id: string }) => s.id))
    for (const e of entries) {
      if (!validIds.has(String(e.siswa_id))) return NextResponse.json({ error: `Siswa ${e.siswa_id} tidak di kelas ini` }, { status: 400 })
      if (!isStatus(e.status)) return NextResponse.json({ error: `Status ${e.status} tidak valid` }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    // Upsert per (siswa_id, tanggal, mata_pelajaran_id) — unique constraint
    const rows = entries.map((e: { siswa_id: string; status: string; keterangan?: string }) => ({
      siswa_id: String(e.siswa_id),
      kelas_id: kelasId,
      guru_id: auth.guruId,
      mata_pelajaran_id: mapelId,
      tanggal,
      status: String(e.status),
      keterangan: e.keterangan ? String(e.keterangan).slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    }))

    // Supabase upsert on_conflict
    const { error } = await supabase
      .from('presensi')
      .upsert(rows, { onConflict: 'siswa_id,tanggal,mata_pelajaran_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ message: 'Presensi tersimpan', saved: rows.length })
  } catch (err) {
    console.error('POST presensi', err)
    return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getProfileRole, getSessionUser, getSupabaseAdmin } from '@/lib/supabase-server'

const STATUS_VALID = ['hadir', 'terlambat', 'izin', 'sakit', 'alfa'] as const
type StatusPresensi = (typeof STATUS_VALID)[number]

const MAPEL_SELECT = `
  id,
  mapel_id,
  kelas_id,
  mata_pelajaran(nama, kode),
  kelas(nama_kelas, tingkat, tahun_ajaran)
`

type MapelEmbed =
  | { nama: string; kode: string }[]
  | { nama: string; kode: string }
  | null

type KelasEmbed =
  | { nama_kelas: string; tingkat: number; tahun_ajaran: string }[]
  | { nama_kelas: string; tingkat: number; tahun_ajaran: string }
  | null

type AssignmentRow = {
  id: string
  mapel_id: string
  kelas_id: string
  mata_pelajaran: MapelEmbed
  kelas: KelasEmbed
}

function isStatusPresensi(v: unknown): v is StatusPresensi {
  return typeof v === 'string' && (STATUS_VALID as readonly string[]).includes(v)
}

// Ambil penugasan milik guru yang sedang login. Return { ok:true,... } | { ok:false,... }
async function getOwnedAssignment(gmId: string, guruId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from('guru_mengajar')
    .select(MAPEL_SELECT)
    .eq('id', gmId)
    .eq('guru_id', guruId)
    .maybeSingle()

  if (error || !data) {
    return { ok: false as const, error: { message: 'Penugasan tidak ditemukan atau bukan milik Anda', status: 404 } }
  }

  const row = data as unknown as AssignmentRow
  const mapel = Array.isArray(row.mata_pelajaran) ? row.mata_pelajaran[0] : row.mata_pelajaran
  const kelas = Array.isArray(row.kelas) ? row.kelas[0] : row.kelas

  return {
    ok: true as const,
    assignment: {
      id: row.id,
      mapel_id: row.mapel_id,
      mapel_nama: mapel?.nama ?? null,
      mapel_kode: mapel?.kode ?? null,
      kelas_id: row.kelas_id,
      kelas_nama: kelas?.nama_kelas ?? null,
      tingkat: kelas?.tingkat ?? null,
      tahun_ajaran: kelas?.tahun_ajaran ?? null,
    },
  }
}

function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00`)
  return !Number.isNaN(d.getTime())
}

// Dapatkan roster siswa aktif di sebuah kelas + presensi mereka pada tanggal tsb.
async function getRosterWithPresensi(gmId: string, kelasId: string, tanggal: string) {
  const supabase = getSupabaseAdmin()

  const [siswaRes, presensiRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nama_lengkap')
      .eq('role', 'siswa')
      .eq('kelas_id', kelasId)
      .eq('status', true)
      .order('nama_lengkap', { ascending: true }),
    supabase
      .from('presensi')
      .select('siswa_id, status, keterangan')
      .eq('guru_mengajar_id', gmId)
      .eq('tanggal', tanggal),
  ])

  if (siswaRes.error) {
    return { error: siswaRes.error.message }
  }
  if (presensiRes.error) {
    return { error: presensiRes.error.message }
  }

  const presensiMap = new Map<string, { status: StatusPresensi; keterangan: string | null }>()
  for (const p of presensiRes.data ?? []) {
    if (isStatusPresensi(p.status)) {
      presensiMap.set(p.siswa_id, { status: p.status, keterangan: p.keterangan ?? null })
    }
  }

  const siswa = (siswaRes.data ?? []).map((s) => ({
    id: s.id,
    nama_lengkap: s.nama_lengkap,
    presensi: presensiMap.get(s.id) ?? null,
  }))

  return { siswa }
}

// GET /api/teacher/presensi?guru_mengajar_id=X&tanggal=YYYY-MM-DD
// Memberikan roster siswa kelas + status presensi mereka pada tanggal tsb.
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Belum login' }, { status: 401 })
    }

    const profile = await getProfileRole(user.id)
    if (profile.role !== 'guru' || profile.status === false) {
      return NextResponse.json({ error: 'Tidak diizinkan. Hanya guru aktif.' }, { status: 403 })
    }

    const gmId = request.nextUrl.searchParams.get('guru_mengajar_id')
    const tanggal = request.nextUrl.searchParams.get('tanggal')

    if (!gmId || !tanggal) {
      return NextResponse.json({ error: 'Parameter guru_mengajar_id dan tanggal wajib diisi.' }, { status: 400 })
    }
    if (!isValidDate(tanggal)) {
      return NextResponse.json({ error: 'Format tanggal tidak valid.' }, { status: 400 })
    }

    const owned = await getOwnedAssignment(gmId, user.id)
    if (!owned.ok) {
      return NextResponse.json({ error: owned.error.message }, { status: owned.error.status })
    }

    const roster = await getRosterWithPresensi(gmId, owned.assignment.kelas_id, tanggal)
    if ('error' in roster) {
      return NextResponse.json({ error: roster.error }, { status: 400 })
    }

    return NextResponse.json({
      assignment: owned.assignment,
      tanggal,
      siswa: roster.siswa,
    })
  } catch (err) {
    console.error('Error GET presensi:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/teacher/presensi
// Body: { guru_mengajar_id, tanggal, entries: [{ siswa_id, status, keterangan? }] }
// Mengisi/memperbarui presensi massal untuk satu hari.
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: 'Belum login' }, { status: 401 })
    }

    const profile = await getProfileRole(user.id)
    if (profile.role !== 'guru' || profile.status === false) {
      return NextResponse.json({ error: 'Tidak diizinkan. Hanya guru aktif.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 })
    }

    const { guru_mengajar_id: gmId, tanggal, entries } = body
    if (!gmId || !tanggal || !Array.isArray(entries)) {
      return NextResponse.json({ error: 'guru_mengajar_id, tanggal, dan entries wajib diisi.' }, { status: 400 })
    }
    if (!isValidDate(tanggal)) {
      return NextResponse.json({ error: 'Format tanggal tidak valid.' }, { status: 400 })
    }

    // Tolak presensi untuk tanggal di masa depan
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (new Date(`${tanggal}T00:00:00`) > today) {
      return NextResponse.json({ error: 'Tidak dapat mengisi presensi untuk tanggal mendatang.' }, { status: 400 })
    }

    const owned = await getOwnedAssignment(gmId, user.id)
    if (!owned.ok) {
      return NextResponse.json({ error: owned.error.message }, { status: owned.error.status })
    }

    // Validasi setiap entry + pastikan siswa benar-benar anggota kelas ini
    const roster = await getRosterWithPresensi(gmId, owned.assignment.kelas_id, tanggal)
    if ('error' in roster) {
      return NextResponse.json({ error: roster.error }, { status: 400 })
    }

    const validSiswaIds = new Set(roster.siswa.map((s) => s.id))
    const rows: {
      guru_mengajar_id: string
      siswa_id: string
      tanggal: string
      status: StatusPresensi
      keterangan: string | null
    }[] = []

    for (const entry of entries) {
      const siswaId = String(entry?.siswa_id ?? '')
      if (!validSiswaIds.has(siswaId)) {
        return NextResponse.json(
          { error: 'Terdapat siswa yang tidak terdaftar di kelas ini.' },
          { status: 400 }
        )
      }
      if (!isStatusPresensi(entry?.status)) {
        return NextResponse.json(
          { error: 'Status presensi tidak valid. Pilihan: hadir, terlambat, izin, sakit, alfa.' },
          { status: 400 }
        )
      }
      const keterangan = entry?.keterangan != null ? String(entry.keterangan).slice(0, 255) : null
      rows.push({
        guru_mengajar_id: gmId,
        siswa_id: siswaId,
        tanggal,
        status: entry.status,
        keterangan,
      })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data presensi untuk disimpan.' }, { status: 400 })
    }

    const { data, error } = await getSupabaseAdmin()
      .from('presensi')
      .upsert(rows, { onConflict: 'guru_mengajar_id,siswa_id,tanggal' })
      .select('siswa_id, status, keterangan')

    if (error) {
      console.error('Upsert presensi failed:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Kembalikan roster terbaru agar UI tetap sinkron
    const fresh = await getRosterWithPresensi(gmId, owned.assignment.kelas_id, tanggal)
    if ('error' in fresh) {
      return NextResponse.json({ error: fresh.error }, { status: 400 })
    }

    return NextResponse.json({
      saved: (data ?? []).length,
      siswa: fresh.siswa,
    })
  } catch (err) {
    console.error('Error POST presensi:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getProfileRole, getSessionUser, getSupabaseAdmin } from '@/lib/supabase-server'

const JENIS_VALID = ['harian', 'tugas', 'uts', 'uas'] as const
type JenisNilai = (typeof JENIS_VALID)[number]
export const JENIS_LABEL: Record<JenisNilai, string> = {
  harian: 'Ulangan Harian',
  tugas: 'Tugas',
  uts: 'UTS',
  uas: 'UAS',
}

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

function isJenisNilai(v: unknown): v is JenisNilai {
  return typeof v === 'string' && (JENIS_VALID as readonly string[]).includes(v)
}

function pickOne<T>(v: T[] | T | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null)
}

// Ambil penugasan milik guru yang sedang login.
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
  const mapel = pickOne(row.mata_pelajaran)
  const kelas = pickOne(row.kelas)

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

// Roster siswa kelas + nilai mereka (4 komponen) pada satu penugasan.
async function getRosterWithNilai(gmId: string, kelasId: string) {
  const supabase = getSupabaseAdmin()

  const [siswaRes, nilaiRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, nama_lengkap')
      .eq('role', 'siswa')
      .eq('kelas_id', kelasId)
      .eq('status', true)
      .order('nama_lengkap', { ascending: true }),
    supabase
      .from('nilai')
      .select('siswa_id, jenis_nilai, nilai')
      .eq('guru_mengajar_id', gmId),
  ])

  if (siswaRes.error) return { error: siswaRes.error.message }
  if (nilaiRes.error) return { error: nilaiRes.error.message }

  const nilaiMap = new Map<string, Partial<Record<JenisNilai, number>>>()
  for (const n of nilaiRes.data ?? []) {
    if (isJenisNilai(n.jenis_nilai) && typeof n.nilai === 'number') {
      const entry = nilaiMap.get(n.siswa_id) ?? {}
      entry[n.jenis_nilai] = n.nilai
      nilaiMap.set(n.siswa_id, entry)
    }
  }

  const siswa = (siswaRes.data ?? []).map((s) => {
    const m = nilaiMap.get(s.id) ?? {}
    return {
      id: s.id,
      nama_lengkap: s.nama_lengkap,
      nilai: {
        harian: m.harian ?? null,
        tugas: m.tugas ?? null,
        uts: m.uts ?? null,
        uas: m.uas ?? null,
      },
    }
  })

  return { siswa }
}

// GET /api/teacher/nilai?guru_mengajar_id=X
// Memberikan roster siswa + nilai per komponen pada penugasan tsb.
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
    if (!gmId) {
      return NextResponse.json({ error: 'Parameter guru_mengajar_id wajib diisi.' }, { status: 400 })
    }

    const owned = await getOwnedAssignment(gmId, user.id)
    if (!owned.ok) {
      return NextResponse.json({ error: owned.error.message }, { status: owned.error.status })
    }

    const roster = await getRosterWithNilai(gmId, owned.assignment.kelas_id)
    if ('error' in roster) {
      return NextResponse.json({ error: roster.error }, { status: 400 })
    }

    return NextResponse.json({ assignment: owned.assignment, siswa: roster.siswa })
  } catch (err) {
    console.error('Error GET nilai:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/teacher/nilai
// Body: { guru_mengajar_id, entries: [{ siswa_id, jenis_nilai, nilai }] }
//   - nilai: angka >= 0; null/undefined => hapus baris nilai tsb.
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

    const { guru_mengajar_id: gmId, entries } = body
    if (!gmId || !Array.isArray(entries)) {
      return NextResponse.json({ error: 'guru_mengajar_id dan entries wajib diisi.' }, { status: 400 })
    }

    const owned = await getOwnedAssignment(gmId, user.id)
    if (!owned.ok) {
      return NextResponse.json({ error: owned.error.message }, { status: owned.error.status })
    }

    // Pastikan siswa benar-benar anggota kelas
    const roster = await getRosterWithNilai(gmId, owned.assignment.kelas_id)
    if ('error' in roster) {
      return NextResponse.json({ error: roster.error }, { status: 400 })
    }
    const validSiswaIds = new Set(roster.siswa.map((s) => s.id))

    const upsertRows: {
      guru_mengajar_id: string
      siswa_id: string
      jenis_nilai: JenisNilai
      nilai: number
    }[] = []
    const deleteKeys: { siswa_id: string; jenis_nilai: JenisNilai }[] = []

    for (const entry of entries) {
      const siswaId = String(entry?.siswa_id ?? '')
      if (!validSiswaIds.has(siswaId)) {
        return NextResponse.json({ error: 'Terdapat siswa yang tidak terdaftar di kelas ini.' }, { status: 400 })
      }
      if (!isJenisNilai(entry?.jenis_nilai)) {
        return NextResponse.json({ error: 'Jenis nilai tidak valid. Pilihan: harian, tugas, uts, uas.' }, { status: 400 })
      }

      if (entry?.nilai === null || entry?.nilai === undefined || entry?.nilai === '') {
        deleteKeys.push({ siswa_id: siswaId, jenis_nilai: entry.jenis_nilai })
        continue
      }

      const value = Number(entry.nilai)
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        return NextResponse.json({ error: 'Nilai harus berupa angka antara 0 dan 100.' }, { status: 400 })
      }

      upsertRows.push({
        guru_mengajar_id: gmId,
        siswa_id: siswaId,
        jenis_nilai: entry.jenis_nilai,
        nilai: Math.round(value * 100) / 100,
      })
    }

    // Hapus yang dikosongkan
    if (deleteKeys.length > 0) {
      for (const key of deleteKeys) {
        await getSupabaseAdmin()
          .from('nilai')
          .delete()
          .eq('guru_mengajar_id', gmId)
          .eq('siswa_id', key.siswa_id)
          .eq('jenis_nilai', key.jenis_nilai)
      }
    }

    // Simpan/update yang terisi
    if (upsertRows.length > 0) {
      const { error } = await getSupabaseAdmin()
        .from('nilai')
        .upsert(upsertRows, { onConflict: 'guru_mengajar_id,siswa_id,jenis_nilai' })

      if (error) {
        console.error('Upsert nilai failed:', error)
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    const fresh = await getRosterWithNilai(gmId, owned.assignment.kelas_id)
    if ('error' in fresh) {
      return NextResponse.json({ error: fresh.error }, { status: 400 })
    }

    return NextResponse.json({
      saved: upsertRows.length,
      removed: deleteKeys.length,
      siswa: fresh.siswa,
    })
  } catch (err) {
    console.error('Error POST nilai:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
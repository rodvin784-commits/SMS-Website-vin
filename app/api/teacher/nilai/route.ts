import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-server'
import { guruAuth, getGuruKelas, getSiswaKelas } from '@/lib/guru-auth'

// Schema tabel nilai (DATABASE_CONTEXT.md #19):
// satu baris per (siswa, guru, mata_pelajaran, semester, tahun_ajaran):
//   tugas NUMERIC, uts NUMERIC, uas NUMERIC, nilai_akhir NUMERIC
// nilai_akhir dihitung bobot: 30% tugas + 30% UTS + 40% UAS
// (komponen yang kosong tidak ikut dirata-rata).

type Komponen = 'tugas' | 'uts' | 'uas'
const KOMPONEN: Komponen[] = ['tugas', 'uts', 'uas']

function hitungNilaiAkhir(t: number | null, u: number | null, a: number | null): number | null {
  const parts: { v: number; w: number }[] = []
  if (t !== null) parts.push({ v: t, w: 0.3 })
  if (u !== null) parts.push({ v: u, w: 0.3 })
  if (a !== null) parts.push({ v: a, w: 0.4 })
  if (parts.length === 0) return null
  const total = parts.reduce((acc, p) => acc + p.v * p.w, 0)
  const totalW = parts.reduce((acc, p) => acc + p.w, 0)
  return Math.round((total / totalW) * 100) / 100
}

type NilaiRow = {
  id: string
  siswa_id: string
  tugas: number | null
  uts: number | null
  uas: number | null
  nilai_akhir: number | null
  semester: string | null
  tahun_ajaran: string | null
}

// GET /api/teacher/nilai?mata_pelajaran_id=..&kelas_id=..&semester=..&tahun_ajaran=..
// Roster siswa kelas + nilai pada mapel tsb.
export async function GET(request: NextRequest) {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const sp = request.nextUrl.searchParams
    const mapelId = sp.get('mata_pelajaran_id')
    const kelasId = sp.get('kelas_id')
    const semester = sp.get('semester') || 'ganjil'
    const tahunAjaran = sp.get('tahun_ajaran')

    if (!mapelId || !kelasId) {
      return NextResponse.json(
        { error: 'Parameter mata_pelajaran_id dan kelas_id wajib diisi.' },
        { status: 400 }
      )
    }

    // Cek penugasan via guru_kelas (keamanan server-side)
    const penugasan = await getGuruKelas(auth.guruId)
    const assigned = penugasan.some(
      (p) => p.mata_pelajaran_id === mapelId && p.kelas_id === kelasId
    )
    if (!assigned) {
      return NextResponse.json(
        { error: 'Anda tidak mengajar mapel ini di kelas tersebut.' },
        { status: 403 }
      )
    }

    const [siswaRes, nilaiRes] = await Promise.all([
      getSiswaKelas(kelasId),
      getSupabaseAdmin()
        .from('nilai')
        .select('id, siswa_id, tugas, uts, uas, nilai_akhir, semester, tahun_ajaran')
        .eq('guru_id', auth.guruId)
        .eq('mata_pelajaran_id', mapelId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran ?? ''),
    ])

    if (nilaiRes.error) {
      return NextResponse.json({ error: nilaiRes.error.message }, { status: 400 })
    }

    const nilaiMap = new Map<string, NilaiRow>()
    for (const n of (nilaiRes.data ?? []) as unknown as NilaiRow[]) {
      nilaiMap.set(n.siswa_id, n)
    }

    const siswa = siswaRes.map((s) => {
      const n = nilaiMap.get(s.id)
      return {
        id: s.id,
        nis: s.nis,
        nama_lengkap: s.nama_lengkap,
        nilai: {
          tugas: n?.tugas ?? null,
          uts: n?.uts ?? null,
          uas: n?.uas ?? null,
        },
        nilai_akhir: n?.nilai_akhir ?? null,
      }
    })

    const info = penugasan.find(
      (p) => p.mata_pelajaran_id === mapelId && p.kelas_id === kelasId
    )

    return NextResponse.json({
      assignment: {
        mapel_id: mapelId,
        mapel_nama: info?.mapel_nama ?? null,
        mapel_kode: info?.mapel_kode ?? null,
        kelas_id: kelasId,
        kelas_nama: info?.kelas_nama ?? null,
        tingkat: info?.tingkat ?? null,
        tahun_ajaran: tahunAjaran ?? info?.tahun_ajaran ?? null,
      },
      semester,
      siswa,
    })
  } catch (err) {
    console.error('Error GET nilai:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

// POST /api/teacher/nilai
// Body: { mata_pelajaran_id, kelas_id, semester, tahun_ajaran,
//         entries: [{ siswa_id, tugas?, uts?, uas? }] }
// - Nilai angka 0-100; null/'' = hapus komponen tsb (diset null).
// - Baris nilai di-upsert per (siswa, guru, mapel, semester, tahun_ajaran).
// - nilai_akhir dihitung ulang otomatis.
export async function POST(request: NextRequest) {
  try {
    const auth = await guruAuth()
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 })
    }

    const { mata_pelajaran_id: mapelId, kelas_id: kelasId, semester, tahun_ajaran: tahunAjaran, entries } = body
    if (!mapelId || !kelasId || !semester || !tahunAjaran) {
      return NextResponse.json(
        { error: 'mata_pelajaran_id, kelas_id, semester, dan tahun_ajaran wajib diisi.' },
        { status: 400 }
      )
    }
    if (!Array.isArray(entries)) {
      return NextResponse.json({ error: 'entries wajib berupa array.' }, { status: 400 })
    }

    const penugasan = await getGuruKelas(auth.guruId)
    const assigned = penugasan.some(
      (p) => p.mata_pelajaran_id === mapelId && p.kelas_id === kelasId
    )
    if (!assigned) {
      return NextResponse.json(
        { error: 'Anda tidak mengajar mapel ini di kelas tersebut.' },
        { status: 403 }
      )
    }

    const siswaKelas = await getSiswaKelas(kelasId)
    const validSiswaIds = new Set(siswaKelas.map((s) => s.id))

    // Ambil baris nilai yang sudah ada
    const { data: existingRows, error: fetchErr } = await getSupabaseAdmin()
      .from('nilai')
      .select('id, siswa_id, tugas, uts, uas')
      .eq('guru_id', auth.guruId)
      .eq('mata_pelajaran_id', mapelId)
      .eq('semester', semester)
      .eq('tahun_ajaran', tahunAjaran)

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 400 })
    }
    const existingMap = new Map<string, NilaiRow>()
    for (const r of (existingRows ?? []) as unknown as NilaiRow[]) {
      existingMap.set(r.siswa_id, r)
    }

    let saved = 0
    let cleared = 0

    for (const entry of entries) {
      const siswaId = String(entry?.siswa_id ?? '')
      if (!validSiswaIds.has(siswaId)) {
        return NextResponse.json(
          { error: 'Terdapat siswa yang tidak terdaftar di kelas ini.' },
          { status: 400 }
        )
      }

      const existing = existingMap.get(siswaId)
      const current: Record<Komponen, number | null> = {
        tugas: existing?.tugas ?? null,
        uts: existing?.uts ?? null,
        uas: existing?.uas ?? null,
      }

      let changed = false
      for (const k of KOMPONEN) {
        if (!(k in entry)) continue
        const raw = entry[k]
        if (raw === null || raw === undefined || raw === '') {
          if (current[k] !== null) {
            current[k] = null
            changed = true
            cleared++
          }
          continue
        }
        const v = Number(raw)
        if (!Number.isFinite(v) || v < 0 || v > 100) {
          return NextResponse.json(
            { error: 'Nilai harus berupa angka antara 0 dan 100.' },
            { status: 400 }
          )
        }
        const rounded = Math.round(v * 100) / 100
        if (current[k] !== rounded) {
          current[k] = rounded
          changed = true
          saved++
        }
      }

      if (!changed) continue

      if (existing) {
        const { error } = await getSupabaseAdmin()
          .from('nilai')
          .update({
            tugas: current.tugas,
            uts: current.uts,
            uas: current.uas,
            nilai_akhir: hitungNilaiAkhir(current.tugas, current.uts, current.uas),
          })
          .eq('id', existing.id)
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
      } else {
        const { error } = await getSupabaseAdmin()
          .from('nilai')
          .insert({
            siswa_id: siswaId,
            guru_id: auth.guruId,
            mata_pelajaran_id: mapelId,
            tugas: current.tugas,
            uts: current.uts,
            uas: current.uas,
            nilai_akhir: hitungNilaiAkhir(current.tugas, current.uts, current.uas),
            semester,
            tahun_ajaran: tahunAjaran,
          })
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
      }
    }

    // Muat ulang data terbaru
    const { data: freshRows, error: freshErr } = await getSupabaseAdmin()
      .from('nilai')
      .select('id, siswa_id, tugas, uts, uas, nilai_akhir, semester, tahun_ajaran')
      .eq('guru_id', auth.guruId)
      .eq('mata_pelajaran_id', mapelId)
      .eq('semester', semester)
      .eq('tahun_ajaran', tahunAjaran)

    if (freshErr) {
      return NextResponse.json({ error: freshErr.message }, { status: 400 })
    }

    const freshMap = new Map<string, NilaiRow>()
    for (const n of (freshRows ?? []) as unknown as NilaiRow[]) {
      freshMap.set(n.siswa_id, n)
    }

    const siswa = siswaKelas.map((s) => {
      const n = freshMap.get(s.id)
      return {
        id: s.id,
        nis: s.nis,
        nama_lengkap: s.nama_lengkap,
        nilai: {
          tugas: n?.tugas ?? null,
          uts: n?.uts ?? null,
          uas: n?.uas ?? null,
        },
        nilai_akhir: n?.nilai_akhir ?? null,
      }
    })

    return NextResponse.json({ saved, cleared, siswa })
  } catch (err) {
    console.error('Error POST nilai:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}

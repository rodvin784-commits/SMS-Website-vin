import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { adminCheck, getSupabaseAdmin } from '@/lib/supabase-server'
import { denyResponse, serverError } from '@/lib/api-admin'

const HARI_VALID: readonly string[] = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function parseJam(value: unknown): string | null {
  if (typeof value !== 'string' || !TIME_RE.test(value.trim())) return null
  return value.trim()
}

const pickOne = <T,>(v: T[] | T | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null)

// GET /api/admin/jadwal?kelas_id=...  -> jadwal satu kelas (terurut hari + jam)
// GET /api/admin/jadwal               -> opsi penugasan aktif (untuk form)
export async function GET(request: NextRequest) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) return denyResponse()

    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const kelasId = searchParams.get('kelas_id')

    if (!kelasId) {
      // Mode opsi: penugasan guru_kelas aktif + daftar kelas aktif
      const [{ data: kelas, error: kError }] = await Promise.all([
        supabaseAdmin
          .from('kelas')
          .select('id, nama_kelas, tingkat')
          .eq('status', true)
          .order('tingkat', { ascending: true })
          .order('nama_kelas', { ascending: true }),
      ])

      if (kError) {
        return NextResponse.json({ error: kError.message }, { status: 400 })
      }

      const activeKelas = (kelas ?? []) as { id: string; nama_kelas: string; tingkat: number }[]
      const activeKelasIds = activeKelas.map((k) => k.id)

      type GuruKelasRow = {
        id: string
        guru_id: string
        mata_pelajaran_id: string
        kelas_id: string
        tahun_ajaran: string | null
        guru: { nama_lengkap: string } | { nama_lengkap: string }[] | null
        mata_pelajaran: { nama: string; kode: string } | { nama: string; kode: string }[] | null
      }

      const penugasanQuery = supabaseAdmin
        .from('guru_kelas')
        .select(`
          id,
          guru_id,
          mata_pelajaran_id,
          kelas_id,
          tahun_ajaran,
          guru(nama_lengkap),
          mata_pelajaran(nama, kode)
        `)

      let query = penugasanQuery
      if (activeKelasIds.length > 0) {
        query = penugasanQuery.in('kelas_id', activeKelasIds)
      }

      const { data: penugasan, error: pError } = await query.order('created_at', { ascending: true })

      if (pError) {
        return NextResponse.json({ error: pError.message }, { status: 400 })
      }

      const penugasanOptions = ((penugasan ?? []) as unknown as GuruKelasRow[]).map((p) => {
        const mapel = pickOne(p.mata_pelajaran)
        const guru = pickOne(p.guru)
        const kelasRow = activeKelas.find((k) => k.id === p.kelas_id)
        return {
          guru_kelas_id: p.id,
          label: `${mapel?.nama ?? '-'} — ${guru?.nama_lengkap ?? 'Tanpa Nama'}${kelasRow ? ` (Kelas ${kelasRow.tingkat} ${kelasRow.nama_kelas})` : ''}`,
          tahun_ajaran: p.tahun_ajaran ?? null,
          kelas_id: p.kelas_id,
          mapel_nama: mapel?.nama ?? null,
          guru_nama: guru?.nama_lengkap ?? null,
        }
      })

      return NextResponse.json({
        kelas: activeKelas,
        penugasan: penugasanOptions,
        hari: HARI_VALID.map((h) => ({ value: h, label: h })),
      })
    }

    // Mode jadwal per kelas
    const { data, error } = await supabaseAdmin
      .from('jadwal')
      .select(`
        id, hari, jam_mulai, jam_selesai, ruangan, tahun_ajaran,
        guru_id, mata_pelajaran_id, kelas_id,
        guru(nama_lengkap),
        mata_pelajaran(nama, kode)
      `)
      .eq('kelas_id', kelasId)
      .order('jam_mulai', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    type JadwalRow = {
      id: string
      hari: string | null
      jam_mulai: string | null
      jam_selesai: string | null
      ruangan: string | null
      tahun_ajaran: string | null
      guru_id: string
      mata_pelajaran_id: string
      kelas_id: string
      guru: { nama_lengkap: string } | { nama_lengkap: string }[] | null
      mata_pelajaran: { nama: string; kode: string } | { nama: string; kode: string }[] | null
    }

    const hariOrder = (h: string | null): number => {
      const idx = HARI_VALID.indexOf(h ?? '')
      return idx === -1 ? 99 : idx
    }

    const jadwal = ((data ?? []) as unknown as JadwalRow[])
      .map((r) => {
        const mapel = pickOne(r.mata_pelajaran)
        const guru = pickOne(r.guru)
        return {
          id: r.id,
          hari: r.hari ?? '',
          jam_mulai: (r.jam_mulai ?? '').slice(0, 5),
          jam_selesai: (r.jam_selesai ?? '').slice(0, 5),
          ruangan: r.ruangan,
          tahun_ajaran: r.tahun_ajaran ?? null,
          guru_id: r.guru_id,
          mata_pelajaran_id: r.mata_pelajaran_id,
          kelas_id: r.kelas_id,
          mapel_nama: mapel?.nama ?? null,
          mapel_kode: mapel?.kode ?? null,
          guru_nama: guru?.nama_lengkap ?? null,
        }
      })
      .sort((a, b) => hariOrder(a.hari) - hariOrder(b.hari))

    return NextResponse.json({ jadwal })
  } catch (err) {
    return serverError(err, 'Error listing jadwal:')
  }
}

// POST /api/admin/jadwal
// Body: { guru_kelas_id, hari, jam_mulai, jam_selesai, ruangan? }
export async function POST(request: Request) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) return denyResponse()

    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { guru_kelas_id, hari, jam_mulai, jam_selesai, ruangan } = body

    if (!HARI_VALID.includes(hari)) {
      return NextResponse.json({ error: 'Hari tidak valid' }, { status: 400 })
    }

    const mulai = parseJam(jam_mulai)
    const selesai = parseJam(jam_selesai)
    if (!mulai || !selesai) {
      return NextResponse.json({ error: 'Format jam harus HH:MM (contoh: 07:30)' }, { status: 400 })
    }
    if (selesai <= mulai) {
      return NextResponse.json({ error: 'Jam selesai harus lebih besar dari jam mulai' }, { status: 400 })
    }

    // Pastikan penugasan ada dan ambil guru/mapel/kelas/tahun ajaran-nya
    const { data: penugasan, error: penugasanError } = await supabaseAdmin
      .from('guru_kelas')
      .select('id, guru_id, mata_pelajaran_id, kelas_id, tahun_ajaran')
      .eq('id', guru_kelas_id)
      .maybeSingle()

    if (penugasanError) {
      return NextResponse.json({ error: penugasanError.message }, { status: 400 })
    }
    if (!penugasan) {
      return NextResponse.json({ error: 'Penugasan guru tidak ditemukan' }, { status: 400 })
    }

    if (!penugasan.tahun_ajaran) {
      return NextResponse.json(
        { error: 'Penugasan belum punya tahun ajaran. Atur tahun ajaran di halaman Mata Pelajaran terlebih dahulu.' },
        { status: 400 }
      )
    }

    // Cek bentrok di kelas yang sama (waktu tumpang tindih pada hari yang sama)
    const { data: bentrokKelas, error: kbError } = await supabaseAdmin
      .from('jadwal')
      .select('id')
      .eq('hari', hari)
      .eq('kelas_id', penugasan.kelas_id)
      .lt('jam_mulai', selesai)
      .gt('jam_selesai', mulai)

    if (kbError) {
      return NextResponse.json({ error: kbError.message }, { status: 400 })
    }

    if ((bentrokKelas ?? []).length > 0) {
      return NextResponse.json(
        { error: `Bentrok: kelas ini sudah ada jadwal pada ${hari} jam ${mulai}-${selesai}` },
        { status: 400 }
      )
    }

    // Cek bentrok untuk guru yang sama
    const { data: bentrokGuru, error: gbError } = await supabaseAdmin
      .from('jadwal')
      .select('id')
      .eq('hari', hari)
      .eq('guru_id', penugasan.guru_id)
      .lt('jam_mulai', selesai)
      .gt('jam_selesai', mulai)

    if (gbError) {
      return NextResponse.json({ error: gbError.message }, { status: 400 })
    }

    if ((bentrokGuru ?? []).length > 0) {
      return NextResponse.json(
        { error: `Bentrok: guru ini sudah mengajar di waktu tersebut (${hari} ${mulai}-${selesai})` },
        { status: 400 }
      )
    }

    const { data: result, error: insertError } = await supabaseAdmin
      .from('jadwal')
      .insert({
        guru_id: penugasan.guru_id,
        mata_pelajaran_id: penugasan.mata_pelajaran_id,
        kelas_id: penugasan.kelas_id,
        tahun_ajaran: penugasan.tahun_ajaran,
        hari,
        jam_mulai: mulai,
        jam_selesai: selesai,
        ruangan: typeof ruangan === 'string' && ruangan.trim() !== '' ? ruangan.trim() : null,
      })
      .select('id')
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    return NextResponse.json(
      { message: `Jadwal berhasil ditambahkan (${hari} ${mulai}-${selesai})`, jadwal: result },
      { status: 201 }
    )
  } catch (err) {
    return serverError(err, 'Error creating jadwal:')
  }
}

// DELETE /api/admin/jadwal?id=<jadwal_id>
export async function DELETE(request: NextRequest) {
  try {
    const auth = await adminCheck()
    if (!auth.ok) return denyResponse()

    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID jadwal wajib diisi' }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from('jadwal').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ message: 'Jadwal berhasil dihapus' }, { status: 200 })
  } catch (err) {
    return serverError(err, 'Error deleting jadwal:')
  }
}